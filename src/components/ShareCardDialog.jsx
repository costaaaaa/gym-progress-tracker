import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogActions, Box, Button, Chip, Collapse, FormControlLabel, IconButton, Slider, Switch, Typography,
  CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  AddPhotoAlternate as AddPhotoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  TEMPLATES, DEFAULT_PRESET, CUSTOM_BLOCKS, availablePresets, stepPreset, sanitizePrefs, presetToggles, PHOTO_BACKGROUNDS, FORMATS, PHOTO_ZOOM_MAX, DEFAULT_PHOTO_TRANSFORM,
  layoutShareCard, clampPhotoTransform, zoomPhotoAt, photoMinZoom, photoBox,
} from '../utils/shareCard';
import { loadCardFonts, renderCardToCanvas, canvasToPngFile, loadPhoto } from '../utils/renderShareCard';
import { track } from '../utils/analytics';
import { shareCardStrings } from '../i18n/shareCardStrings';

const SWIPE_MIN_PX = 50;
const PREFS_KEY = 'lx_share_card';

const loadPrefs = () => {
  try {
    return sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY)));
  } catch {
    return sanitizePrefs(null);
  }
};

const CHECKERBOARD = {
  backgroundColor: '#8a8a8a',
  backgroundImage: 'linear-gradient(45deg, #6f6f6f 25%, transparent 25%, transparent 75%, #6f6f6f 75%), linear-gradient(45deg, #6f6f6f 25%, transparent 25%, transparent 75%, #6f6f6f 75%)',
  backgroundSize: '24px 24px',
  backgroundPosition: '0 0, 12px 12px',
};


/**
 * Anteprima e condivisione della card di un allenamento come immagine.
 * stats = buildShareStats(...) da utils/shareCard.js. La foto scelta resta nel
 * browser: si disegna sul canvas e non viene mai inviata al server.
 */
const ShareCardDialog = ({ open, onClose, stats }) => {
  const { t } = useTranslation();
  const bgLabel = (bg) => t(`share.bg.${bg.id}`, { defaultValue: bg.label });
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  // Il PNG si prepara dopo ogni disegno: navigator.share va chiamato subito al tocco,
  // altrimenti Safari lo rifiuta perché il gesto dell'utente è "scaduto".
  const fileRef = useRef(null);
  // Le scelte dell'ultima volta (tranne la foto) si ritrovano alla riapertura
  const [initialPrefs] = useState(loadPrefs);
  const [template, setTemplate] = useState(initialPrefs.template);
  const [format, setFormat] = useState(initialPrefs.format);
  const [preset, setPreset] = useState(initialPrefs.preset);
  // Blocchi scelti con "Personalizza" (null = si usa la card pronta) e pesi nascosti
  const [customBlocks, setCustomBlocks] = useState(initialPrefs.customBlocks);
  const [customizing, setCustomizing] = useState(false);
  const [hideWeights, setHideWeights] = useState(initialPrefs.hideWeights);
  const [showBestVolume, setShowBestVolume] = useState(initialPrefs.showBestVolume);
  const [photo, setPhoto] = useState(null);
  const [photoTransform, setPhotoTransform] = useState(DEFAULT_PHOTO_TRANSFORM);
  const [photoBackground, setPhotoBackground] = useState(PHOTO_BACKGROUNDS[0].id);
  const [fontsReady, setFontsReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  // Dita (o mouse) appoggiate sull'anteprima, in px della card
  const pointersRef = useRef(new Map());

  const presets = useMemo(() => (stats ? availablePresets(stats) : []), [stats]);
  const activePreset = presets.some((p) => p.id === preset) ? preset : DEFAULT_PRESET;
  const shownBlocks = customBlocks || presetToggles(activePreset);
  const toggleBlock = (id) => setCustomBlocks(shownBlocks.includes(id) ? shownBlocks.filter((b) => b !== id) : [...shownBlocks, id]);
  const editable = template === 'foto' && !!photo;
  const cardChoice = customBlocks ? 'custom' : activePreset;
  // Il miglior volume compare solo nell'elenco dei record della card Record
  const canShowBestVolume = cardChoice === 'record' && stats?.recordList.some((r) => r.type === 'volume');
  const trackCard = (action) => track('workout_card', { action, template, card: cardChoice, format: format.id, hide_weights: hideWeights });
  const box = photoBox(format);
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
    const layout = layoutShareCard(stats, template, { hasPhoto: !!photo, photoBackground, format, preset, blocks: customBlocks || undefined, hideWeights, showBestVolume, strings: shareCardStrings() });
    renderCardToCanvas(canvasRef.current, layout, photo, photoTransform);
    setReady(false);
    fileRef.current = null;
    const timer = setTimeout(async () => {
      try {
        const file = await canvasToPngFile(canvasRef.current, t('share.filename'));
        if (!cancelled) {
          fileRef.current = file;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, stats, template, format, preset, customBlocks, hideWeights, showBestVolume, photo, photoTransform, photoBackground, fontsReady, t]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ template, format: format.id, preset, customBlocks, hideWeights, showBestVolume }));
    } catch { /* storage pieno o bloccato: le scelte valgono solo per questa volta */ }
  }, [template, format, preset, customBlocks, hideWeights, showBestVolume]);

  const movePhoto = (update) => {
    if (!photo) return;
    setPhotoTransform((t) => update(t, photo.width, photo.height));
  };

  const zoomAtCenter = (zoom) => movePhoto((t, iw, ih) =>
    zoomPhotoAt(t, zoom / t.zoom, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, iw, ih, box));

  const toCardPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const k = format.width / rect.width;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  };

  const goToPreset = (step) => {
    setPreset(stepPreset(stats, activePreset, step));
    setCustomBlocks(null);
  };

  // Mouse: trascinare sposta la foto. Touch: un dito scorre tra le card pronte, due dita
  // spostano e ingrandiscono la foto.
  const swipeRef = useRef(null);
  const handlePointerDown = (e) => {
    const touch = e.pointerType === 'touch';
    if (!touch && !editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, toCardPoint(e));
    if (touch) {
      swipeRef.current = pointersRef.current.size === 1
        ? { x: e.clientX, y: e.clientY, multi: false }
        : { ...swipeRef.current, multi: true };
    }
  };

  const handlePointerMove = (e) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    const before = [...pointers.values()].slice(0, 2);
    pointers.set(e.pointerId, toCardPoint(e));
    const after = [...pointers.values()].slice(0, 2);
    if (e.pointerType === 'touch' && (after.length === 1 || !editable)) return;
    if (after.length === 1) {
      const dx = after[0].x - before[0].x;
      const dy = after[0].y - before[0].y;
      movePhoto((t, iw, ih) => clampPhotoTransform({ ...t, dx: t.dx + dx, dy: t.dy + dy }, iw, ih, box));
      return;
    }
    const mid = (p) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const m0 = mid(before);
    const m1 = mid(after);
    const factor = dist(before) > 0 ? dist(after) / dist(before) : 1;
    movePhoto((t, iw, ih) => zoomPhotoAt({ ...t, dx: t.dx + m1.x - m0.x, dy: t.dy + m1.y - m0.y }, factor, m1, iw, ih, box));
  };

  const handlePointerUp = (e) => {
    const swipe = swipeRef.current;
    const wasOnlyFinger = e.pointerType === 'touch' && pointersRef.current.size === 1 && swipe && !swipe.multi;
    pointersRef.current.delete(e.pointerId);
    if (!wasOnlyFinger || e.type === 'pointercancel') return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) goToPreset(dx < 0 ? 1 : -1);
  };

  // Rotella del mouse / pinch del trackpad. Va registrata a mano: React la rende
  // passiva e preventDefault non fermerebbe lo scorrimento della pagina.
  const wheelRef = useRef(null);
  wheelRef.current = (e) => {
    if (!editable) return;
    e.preventDefault();
    const point = toCardPoint(e);
    movePhoto((t, iw, ih) => zoomPhotoAt(t, Math.exp(-e.deltaY * 0.002), point, iw, ih, box));
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
      setError(t('share.error_photo'));
    }
  };

  // La foto resta nei limiti del nuovo riquadro (quadrato o storia)
  const handleFormat = (next) => {
    setFormat(next);
    if (photo) setPhotoTransform((t) => clampPhotoTransform(t, photo.width, photo.height, photoBox(next)));
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
      trackCard('download');
      return;
    }
    try {
      await navigator.share({ files: [file] });
      trackCard('share');
    } catch (e) {
      // AbortError = l'utente ha chiuso il foglio di condivisione
      if (e?.name !== 'AbortError') download(file);
    }
  };

  const canCopyImage = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
    && (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'));

  const handleCopy = async () => {
    const file = fileRef.current;
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      trackCard('copy');
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('share.error_copy'));
    }
  };

  const handleDownload = () => {
    if (!fileRef.current) return;
    download(fileRef.current);
    trackCard('download');
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : '16px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>{t('share.title')}</Typography>
        <IconButton onClick={onClose} aria-label={t('share.close')}><CloseIcon /></IconButton>
      </Box>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {presets.map((p) => (
            <Chip key={p.id} label={t(`share.preset.${p.id}`, { defaultValue: p.label })} size="small" onClick={() => { setPreset(p.id); setCustomBlocks(null); }}
              color={!customBlocks && activePreset === p.id ? 'primary' : 'default'}
              variant={!customBlocks && activePreset === p.id ? 'filled' : 'outlined'} />
          ))}
          {customBlocks && <Chip label={t('share.customized')} size="small" color="primary" />}
          <Chip icon={<TuneIcon />} label={t('share.customize')} size="small" variant="outlined"
            onClick={() => setCustomizing((v) => !v)} />
        </Box>
        <Collapse in={customizing} sx={{ width: '100%', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', px: 2 }}>
            {CUSTOM_BLOCKS.map((b) => (
              <FormControlLabel key={b.id} label={t(`share.block.${b.id}`, { defaultValue: b.label })}
                control={<Switch size="small" checked={shownBlocks.includes(b.id)} onChange={() => toggleBlock(b.id)} />} />
            ))}
            <FormControlLabel label={t('share.hide_weights')}
              control={<Switch size="small" checked={hideWeights} onChange={(e) => setHideWeights(e.target.checked)} />} />
            {canShowBestVolume && (
              <FormControlLabel label={t('share.show_best_volume')}
                control={<Switch size="small" checked={showBestVolume} onChange={(e) => setShowBestVolume(e.target.checked)} />} />
            )}
          </Box>
        </Collapse>
        <Box sx={{ position: 'relative', width: '100%', maxWidth: `calc(62vh * ${format.width} / ${format.height})`, aspectRatio: `${format.width} / ${format.height}` }}>
          <canvas ref={canvasRef}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            style={{
              width: '100%', height: '100%', borderRadius: 12, display: 'block', ...(template === 'trasparente' ? CHECKERBOARD : { background: '#0a0a0b' }),
              touchAction: editable ? 'none' : 'pan-y', cursor: editable ? 'grab' : 'default',
            }} />
          {!fontsReady && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TEMPLATES.map((tpl) => (
            <Chip key={tpl.id} label={t(`share.template.${tpl.id}`, { defaultValue: tpl.label })} onClick={() => handleTemplate(tpl.id)}
              color={template === tpl.id ? 'primary' : 'default'}
              variant={template === tpl.id ? 'filled' : 'outlined'} />
          ))}
          {template !== 'trasparente' && (
            <Chip icon={<AddPhotoIcon />} label={photo ? t('share.change_photo') : t('share.add_photo')} variant="outlined"
              onClick={() => fileInputRef.current?.click()} />
          )}
        </Box>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          {FORMATS.map((f) => (
            <Chip key={f.id} label={t(`share.format.${f.id}`, { defaultValue: f.label })} size="small" onClick={() => handleFormat(f)}
              color={format.id === f.id ? 'primary' : 'default'}
              variant={format.id === f.id ? 'filled' : 'outlined'} />
          ))}
        </Box>

        {editable && (
          <Box sx={{ width: '100%', maxWidth: 360 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ZoomOutIcon fontSize="small" color="action" />
              <Slider size="small" aria-label={t('share.zoom')}
                // min arrotondato al passo, così 1 (foto a tutta card) è un valore dello slider;
                // il limite vero lo applica zoomPhotoAt
                min={Math.floor(photoMinZoom(photo.width, photo.height, box) * 100) / 100} max={PHOTO_ZOOM_MAX} step={0.01}
                value={photoTransform.zoom} onChange={(_, v) => zoomAtCenter(v)} />
              <ZoomInIcon fontSize="small" color="action" />
              <IconButton size="small" aria-label={t('share.center')}
                onClick={() => setPhotoTransform(DEFAULT_PHOTO_TRANSFORM)}>
                <CenterIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'center' }}>
              {t('share.photo_hint')}
            </Typography>
            {backgroundVisible && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>{t('share.background')}</Typography>
                {PHOTO_BACKGROUNDS.map((bg) => (
                  <Box key={bg.id} component="button" type="button" aria-label={t('share.background_named', { name: bgLabel(bg) })}
                    aria-pressed={photoBackground === bg.id} title={bgLabel(bg)}
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
          {t('share.download')}
        </Button>
        {canCopyImage && (
          <Button variant="outlined" startIcon={copied ? <CheckIcon /> : <CopyIcon />} onClick={handleCopy} disabled={!ready}>
            {copied ? t('share.copied') : t('share.copy')}
          </Button>
        )}
        <Button variant="contained" startIcon={<ShareIcon />} onClick={handleShare} disabled={!ready} sx={{ flex: 1 }}>
          {t('share.share')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareCardDialog;
