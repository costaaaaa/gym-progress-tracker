// Coordinate x di una polyline SVG ('x1,y1 x2,y2 …'): accetta la stringa o l'elemento <polyline>.
export const polylineX = (polyline) => {
  const points = typeof polyline === 'string' ? polyline : polyline.getAttribute('points');
  return points.split(' ').map((p) => Number(p.split(',')[0]));
};
