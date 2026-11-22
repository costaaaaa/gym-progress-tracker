import { useState } from 'react';
import { Box, Typography, Card, Button } from '@mui/material';
import { DeleteForever as DeleteForeverIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import useAccountDeleted from '../../hooks/useAccountDeleted';
import DeleteAccountDialog from '../../components/Account/DeleteAccountDialog';

// Zona pericolosa: il pulsante «Elimina account» e la sua finestra (con password e conferma). Eliminazione riuscita:
// l'esito va a notify(message, severity) e, dopo un breve delay, logout e home.
const DeleteAccountCard = ({ notify }) => {
  const { t } = useTranslation();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const handleAccountDeleted = useAccountDeleted(notify);

  return (
    <>
      <Card sx={{ p: '24px', bgcolor: 'error.muted', border: '1px solid', borderColor: 'error.border' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle" sx={{ color: 'error.title' }}>{t('account.danger.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.danger.help')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setOpenDeleteDialog(true)}
            sx={{ fontSize: 16 }}
          >
            {t('account.delete.title')}
          </Button>
        </Box>
      </Card>

      <DeleteAccountDialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} onDeleted={handleAccountDeleted} />
    </>
  );
};

export default DeleteAccountCard;
