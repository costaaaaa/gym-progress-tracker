import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Button, Chip, IconButton, Slider, Typography,
  CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  AddPhotoAlternate as AddPhotoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
} from '@mui/icons-material';
import {
  TEMPLATES, PHOTO_BACKGROUNDS, CARD_WIDTH, PHOTO_BOX, PHOTO_ZOOM_MAX, DEFAULT_PHOTO_TRANSFORM,
  layoutShareCard, clampPhotoTransform, zoomPhotoAt, photoMinZoom,
} from '../utils/shareCard';
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
  const [photoTransform, setPhotoTransform] = useState(DEFAULT_PHOTO_TRANSFORM);
  const [photoBackground, setPhotoBackground] = useState(PHOTO_BACKGROUNDS[0].id);
  const [fontsReady, setFontsReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  // Dita (o mouse) appoggiate sull'anteprima, in px della card
  const pointersRef = useRef(new Map());

  const editable = template === 'foto' && !!photo;
  // Lo sfondo si vede solo quando la foto, rimpicciolita, non copre più la card
  const backgroundVisible = editable && photoTransform.zoom < 0.999;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    loadCardFonts().then(() => { if (!cancelled) setFontsReady(true); });
    return () => { cancelled = true; };
  }, [open]);

  // Il disegno segue subito ogni spostamento della foto; il PNG si prepara solo quando
  // l'utente si ferma, perché costa più del disegno.
  useEffect(() => {
    if (!open || !stats || !fontsReady || !canvasRef.current) return undefined;
    let cancelled = false;
    const layout = layoutShareCard(stats, template, { hasPhoto: !!photo, photoBackground });
    renderCardToCanvas(canvasRef.current, layout, photo, photoTransform);
    setReady(false);
    fileRef.current = null;
    const timer = setTimeout(async () => {
      try {
        const file = await canvasToPngFile(canvasRef.current, 'liftindex-allenamento.png');
        if (!cancelled) {
          fileRef.current = file;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, stats, template, photo, photoTransform, photoBackground, fontsReady]);

  const movePhoto = (update) => {
    if (!photo) return;
    setPhotoTransform((t) => update(t, photo.width, photo.height));
  };

  const zoomAtCenter = (zoom) => movePhoto((t, iw, ih) =>
    zoomPhotoAt(t, zoom / t.zoom, { x: PHOTO_BOX.x + PHOTO_BOX.w / 2, y: PHOTO_BOX.y + PHOTO_BOX.h / 2 }, iw, ih));

  const toCardPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const k = CARD_WIDTH / rect.width;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  };

  // Un dito (o il mouse) sposta la foto, due dita la spostano e la ingrandiscono.
  const handlePointerDown = (e) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, toCardPoint(e));
  };

  const handlePointerMove = (e) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    const before = [...pointers.values()].slice(0, 2);
    pointers.set(e.pointerId, toCardPoint(e));
    const after = [...pointers.values()].slice(0, 2);
    if (after.length === 1) {
      const dx = after[0].x - before[0].x;
      const dy = after[0].y - before[0].y;
      movePhoto((t, iw, ih) => clampPhotoTransform({ ...t, dx: t.dx + dx, dy: t.dy + dy }, iw, ih));
      return;
    }
    const mid = (p) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const m0 = mid(before);
    const m1 = mid(after);
    const factor = dist(before) > 0 ? dist(after) / dist(before) : 1;
    movePhoto((t, iw, ih) => zoomPhotoAt({ ...t, dx: t.dx + m1.x - m0.x, dy: t.dy + m1.y - m0.y }, factor, m1, iw, ih));
  };

  const handlePointerUp = (e) => { pointersRef.current.delete(e.pointerId); };

  // Rotella del mouse / pinch del trackpad. Va registrata a mano: React la rende
  // passiva e preventDefault non fermerebbe lo scorrimento della pagina.
  const wheelRef = useRef(null);
  wheelRef.current = (e) => {
    if (!editable) return;
    e.preventDefault();
    const point = toCardPoint(e);
    movePhoto((t, iw, ih) => zoomPhotoAt(t, Math.exp(-e.deltaY * 0.002), point, iw, ih));
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!open || !fontsReady || !canvas) return undefined;
    const onWheel = (e) => wheelRef.current(e);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [open, fontsReady]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setError('');
      setPhoto(await loadPhoto(file));
      setPhotoTransform(DEFAULT_PHOTO_TRANSFORM);
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
          <canvas ref={canvasRef}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            style={{
              width: '100%', height: '100%', borderRadius: 12, display: 'block', background: '#0a0a0b',
              touchAction: editable ? 'none' : 'auto', cursor: editable ? 'grab' : 'default',
            }} />
          {!fontsReady && (
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

        {editable && (
          <Box sx={{ width: '100%', maxWidth: 360 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ZoomOutIcon fontSize="small" color="action" />
              <Slider size="small" aria-label="Zoom della foto"
                // min arrotondato al passo, così 1 (foto a tutta card) è un valore dello slider;
                // il limite vero lo applica zoomPhotoAt
                min={Math.floor(photoMinZoom(photo.width, photo.height) * 100) / 100} max={PHOTO_ZOOM_MAX} step={0.01}
                value={photoTransform.zoom} onChange={(_, v) => zoomAtCenter(v)} />
              <ZoomInIcon fontSize="small" color="action" />
              <IconButton size="small" aria-label="Rimetti la foto al centro"
                onClick={() => setPhotoTransform(DEFAULT_PHOTO_TRANSFORM)}>
                <CenterIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'center' }}>
              Trascina la foto per spostarla, usa due dita o la rotella per ingrandirla
            </Typography>
            {backgroundVisible && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Sfondo</Typography>
                {PHOTO_BACKGROUNDS.map((bg) => (
                  <Box key={bg.id} component="button" type="button" aria-label={`Sfondo ${bg.label}`}
                    aria-pressed={photoBackground === bg.id} title={bg.label}
                    onClick={() => setPhotoBackground(bg.id)}
                    sx={{
                      width: 28, height: 28, p: 0, borderRadius: '50%', cursor: 'pointer',
                      background: `linear-gradient(${bg.stops[0]}, ${bg.stops[1]})`,
                      border: '2px solid', borderColor: 'background.paper',
                      outline: '2px solid',
                      outlineColor: photoBackground === bg.id ? theme.palette.primary.main : theme.palette.divider,
                    }} />
                ))}
              </Box>
            )}
          </Box>
        )}

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
