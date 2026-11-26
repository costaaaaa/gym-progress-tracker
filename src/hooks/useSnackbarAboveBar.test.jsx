// Gli avvisi stanno sopra la barra in basso del telefono, solo dove la barra c'è. jsdom non risolve env(): qui si
// controlla quello che dice davvero (il calc con l'area sicura e i px sopra l'altezza della barra); il valore
// reale sul telefono resta da guardare in un browser.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Snackbar } from '@mui/material';
import { BottomBarContext } from './useBottomBarVisible';
import { useSnackbarAboveBar } from './useSnackbarAboveBar';
import { BAR_HEIGHT } from '../components/Layout/barMetrics';
import { expectNoticeAboveBar, expectNoticeInPlace, expectNoticeStacked, noticeOffset } from '../test/dom';

const Notice = ({ stacked }) => <Snackbar open message={stacked ? 'Sopra' : 'Fatto'} sx={useSnackbarAboveBar(stacked)} />;
const show = (barVisible, notices = <Notice />) => render(<BottomBarContext.Provider value={barVisible}>{notices}</BottomBarContext.Provider>);

describe('avvisi sopra la barra in basso', () => {
  it('con la barra l\'avviso sta sopra la barra e l\'area sicura, senza staccarsene', () => {
    show(true);
    expectNoticeAboveBar(screen.getByText('Fatto'));
    expect(noticeOffset(screen.getByText('Fatto'))).toBeLessThanOrEqual(BAR_HEIGHT + 24);
  });

  it('senza la barra l\'avviso non sale', () => {
    show(false);
    expectNoticeInPlace(screen.getByText('Fatto'));
  });

  it('fuori da un Layout (nessun provider) vale «nessuna barra»', () => {
    render(<Notice />);
    expectNoticeInPlace(screen.getByText('Fatto'));
  });

  it.each([['con la barra', true], ['senza la barra', false]])('%s il secondo avviso sta sopra il primo senza coprirlo', (_, barVisible) => {
    show(barVisible, <><Notice /><Notice stacked /></>);
    expectNoticeStacked(screen.getByText('Sopra'), screen.getByText('Fatto'));
  });
});
