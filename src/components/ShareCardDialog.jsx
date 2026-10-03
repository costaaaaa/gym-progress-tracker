import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Button, Chip, IconButton, Typography,
  CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  AddPhotoAlternate as AddPhotoIcon,
} from '@mui/icons-material';
import { TEMPLATES, layoutShareCard } from '../utils/shareCard';
import { loadCardFonts, renderCardToCanvas, canvasToPngFile, loadPhoto } from '../utils/renderShareCard';
import { track } from '../utils/analytics';

/**
 * Anteprima e condivisione della card di un allenamento come immagine.
 * stats = buildShareStats(...) da utils/shareCard.js. La foto scelta resta nel
 * browser: si disegna sul canvas e non viene mai inviata al server.
 */
const ShareCardDialog = ({ open, onClose, stats }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  // Il PNG si prepara dopo ogni disegno: navigator.share va chiamato subito al tocco,
  // altrimenti Safari lo rifiuta perché il gesto dell'utente è "scaduto".
  const fileRef = useRef(null);
  const [template, setTemplate] = useState('scuro');
  const [photo, setPhoto] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !stats) return undefined;
    let cancelled = false;
    setReady(false);
    fileRef.current = null;
    loadCardFonts().then(async () => {
      if (cancelled || !canvasRef.current) return;
      const layout = layoutShareCard(stats, template, { hasPhoto: !!photo });
      renderCardToCanvas(canvasRef.current, layout, photo);
      try {
        const file = await canvasToPngFile(canvasRef.current, 'liftindex-allenamento.png');
        if (!cancelled) {
          fileRef.current = file;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    });
    return () => { cancelled = true; };
  }, [open, stats, template, photo]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setError('');
      setPhoto(await loadPhoto(file));
      setTemplate('foto');
    } catch {
      setError('Non riesco a leggere questa foto, prova con un\'altra.');
    }
  };

  const handleTemplate = (id) => {
    setTemplate(id);
    if (id === 'foto' && !photo) fileInputRef.current?.click();
  };

  const download = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const canShareFiles = () => {
    const file = fileRef.current;
    return !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  };

  const handleShare = async () => {
    const file = fileRef.current;
    if (!file) return;
    if (!canShareFiles()) {
      download(file);
      track('workout_card', { action: 'download', template });
      return;
    }
    try {
      await navigator.share({ files: [file] });
      track('workout_card', { action: 'share', template });
    } catch (e) {
      // AbortError = l'utente ha chiuso il foglio di condivisione
      if (e?.name !== 'AbortError') download(file);
    }
  };

  const handleDownload = () => {
    if (!fileRef.current) return;
    download(fileRef.current);
    track('workout_card', { action: 'download', template });
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : '16px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>Condividi</Typography>
        <IconButton onClick={onClose} aria-label="Chiudi"><CloseIcon /></IconButton>
      </Box>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 1 }}>
        <Box sx={{ position: 'relative', width: '100%', maxWidth: 'calc(62vh * 9 / 16)', aspectRatio: '9 / 16' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: 12, display: 'block', background: '#0a0a0b' }} />
          {!ready && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TEMPLATES.map((t) => (
            <Chip key={t.id} label={t.label} onClick={() => handleTemplate(t.id)}
              color={template === t.id ? 'primary' : 'default'}
              variant={template === t.id ? 'filled' : 'outlined'} />
          ))}
          <Chip icon={<AddPhotoIcon />} label={photo ? 'Cambia foto' : 'Aggiungi foto'} variant="outlined"
            onClick={() => fileInputRef.current?.click()} />
        </Box>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />

        {error && <Typography variant="body2" color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!ready}>
          Scarica
        </Button>
        <Button variant="contained" startIcon={<ShareIcon />} onClick={handleShare} disabled={!ready} sx={{ flex: 1 }}>
          Condividi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareCardDialog;
