// Chip "Ultima volta" di Focus: una serie senza peso ("8 rip" / "8 reps") segue la lingua
import { describe, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import i18n from '../../i18n';
import WorkoutPhase from './WorkoutPhase';

const noop = () => {};
const props = {
  currentExercise: { exercise_name: 'Trazioni', planned_sets: [{ kind: 'working', min: 8, max: 8 }] },
  currentExerciseIndex: 0, totalExercises: 1, currentSetIndex: 0, totalSlotsForCurrentExercise: 1,
  currentSlot: { isWarmup: false, workingIndex: 0, workingCount: 1 },
  currentExerciseSets: [], canSwap: false, currentSkippedSets: [],
  lastSession: { sets: [{ weight: 0, reps: 8 }] },
  weightInput: '', repsInput: '', intensityTechniqueInput: '',
  onWeightChange: noop, onRepsChange: noop, onIntensityChange: noop, onConfirmSet: noop, onSkipSet: noop,
  onSkipWarmup: noop, onSkipExercise: noop, onOpenPicker: noop, onQuit: noop, onCloseQuitDialog: noop,
  onConfirmQuit: noop, onCloseRepsConfirm: noop, onConfirmReps: noop,
  quitDialogOpen: false, repsConfirmOpen: false, totalCompletedSets: 0, canEditSession: false,
};
const renderPhase = () => render(<ThemeModeProvider><WorkoutPhase {...props} /></ThemeModeProvider>);

describe('chip "Ultima volta" senza peso', () => {
  it('in italiano dice "8 rip"', () => {
    renderPhase();
    screen.getByText('8 rip');
  });

  it('in inglese dice "8 reps"', async () => {
    await i18n.changeLanguage('en');
    renderPhase();
    screen.getByText('8 reps');
  });

  it('in inglese una sola ripetizione è singolare: "1 rep"', async () => {
    await i18n.changeLanguage('en');
    render(<ThemeModeProvider><WorkoutPhase {...props} lastSession={{ sets: [{ weight: 0, reps: 1 }] }} /></ThemeModeProvider>);
    screen.getByText('1 rep');
  });
});
