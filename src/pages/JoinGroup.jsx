import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CircularProgress, Container, Typography } from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import { usePageMeta } from '../hooks/usePageMeta';
import RequireLogin from '../components/Groups/RequireLogin';
import ShareConsentDialog from '../components/Groups/ShareConsentDialog';
import { errorMessage, GROUP_TYPE_LABELS, joinGroup, previewGroup } from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { track } from '../utils/analytics';

// /entra?codice=XXXXXXXXXX — anteprima del gruppo e ingresso con consenso.
// Chi non ha fatto l'accesso passa da login o registrazione e torna qui (RequireLogin).
const JoinGroupContent = () => {
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('codice') || '').replace(/\s+/g, '').toUpperCase();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Link di invito incompleto: manca il codice.');
      return;
    }
    previewGroup(code).then((res) => {
      if (res.ok) setPreview(res.data.group);
      else setError(errorMessage(res, 'Codice invito non valido o scaduto.'));
    });
  }, [code]);

  const join = async () => {
    setJoining(true);
    const res = await joinGroup(code);
    setJoining(false);
    if (!res.ok) {
      setConsentOpen(false);
      setError(errorMessage(res));
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
            {/(data di nascita|impostazioni)/i.test(error) && (
              <Button component={RouterLink} to="/profilo?tab=settings" sx={{ mr: 1 }}>Vai alle impostazioni</Button>
            )}
            <Button component={RouterLink} to="/gruppi">I tuoi gruppi</Button>
          </>
        )}
        {!error && !preview && <CircularProgress sx={{ my: 2 }} />}
        {!error && preview && (
          <>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Sei stato invitato in</Typography>
            <Typography component="h1" sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 26, my: 1 }}>
              {preview.name}
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>
              {GROUP_TYPE_LABELS[preview.type]} · {preview.members_count} {preview.members_count === 1 ? 'membro' : 'membri'}
            </Typography>
            {preview.already_member ? (
              <Button variant="contained" component={RouterLink} to={`/gruppi/${preview.id}`}>Apri il gruppo</Button>
            ) : preview.is_full ? (
              <Alert severity="warning">Il gruppo ha raggiunto il numero massimo di membri.</Alert>
            ) : (
              <Box>
                <Button variant="contained" size="large" onClick={() => setConsentOpen(true)}>Entra nel gruppo</Button>
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
  usePageMeta('Entra nel gruppo', 'Unisciti al gruppo su Liftindex e confronta la tua costanza con amici e compagni di palestra.');
  return <RequireLogin><JoinGroupContent /></RequireLogin>;
};

export default JoinGroup;
