import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CircularProgress, Container, Typography } from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import { usePageMeta } from '../hooks/usePageMeta';
import RequireLogin from '../components/Groups/RequireLogin';
import ShareConsentDialog from '../components/Groups/ShareConsentDialog';
import { errorMessage, groupTypeLabel, joinGroup, previewGroup } from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { track } from '../utils/analytics';

// /entra?codice=XXXXXXXXXX — anteprima del gruppo e ingresso con consenso.
// Chi non ha fatto l'accesso passa da login o registrazione e torna qui (RequireLogin).
const JoinGroupContent = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('codice') || '').replace(/\s+/g, '').toUpperCase();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) {
      setError(t('groups.join.incomplete'));
      return;
    }
    previewGroup(code).then((res) => {
      if (res.ok) setPreview(res.data.group);
      else {
        setError(errorMessage(res, t('groups.join.invalid')));
        setErrorCode(res.data?.code || '');
      }
    });
  }, [code, t]);

  const join = async () => {
    setJoining(true);
    const res = await joinGroup(code);
    setJoining(false);
    if (!res.ok) {
      setConsentOpen(false);
      setError(errorMessage(res));
      setErrorCode(res.data?.code || '');
      return;
    }
    if (!res.data.already_member) track('group_joined');
    navigate(`/gruppi/${res.data.group_id}`, { replace: true });
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <GroupsOutlined sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        {error && (
          <>
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>
            {errorCode === 'birth_date_required' && (
              <Button component={RouterLink} to="/profilo?tab=settings" sx={{ mr: 1 }}>{t('groups.join.settings')}</Button>
            )}
            <Button component={RouterLink} to="/gruppi">{t('groups.join.your_groups')}</Button>
          </>
        )}
        {!error && !preview && <CircularProgress sx={{ my: 2 }} />}
        {!error && preview && (
          <>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{t('groups.join.invited')}</Typography>
            <Typography component="h1" sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 26, my: 1 }}>
              {preview.name}
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>
              {groupTypeLabel(preview.type)} · {t('groups_card.members', { count: Number(preview.members_count) })}
            </Typography>
            {preview.already_member ? (
              <Button variant="contained" component={RouterLink} to={`/gruppi/${preview.id}`}>{t('groups.join.open')}</Button>
            ) : preview.is_full ? (
              <Alert severity="warning">{t('groups.join.full')}</Alert>
            ) : (
              <Box>
                <Button variant="contained" size="large" onClick={() => setConsentOpen(true)}>{t('groups.join.cta')}</Button>
              </Box>
            )}
          </>
        )}
      </Card>
      <ShareConsentDialog
        open={consentOpen}
        groupName={preview?.name}
        username={user?.username}
        loading={joining}
        onClose={() => setConsentOpen(false)}
        onConfirm={join}
      />
    </Container>
  );
};

const JoinGroup = () => {
  const { t } = useTranslation();
  usePageMeta(t('groups.join.meta_title'), t('groups.join.meta_description'));
  return <RequireLogin><JoinGroupContent /></RequireLogin>;
};

export default JoinGroup;
