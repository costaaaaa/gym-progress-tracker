// Marchio LiftIndex: quattro barrette a capi tondi, ridisegnate da public/logo512.png (160×122 px
// nell'icona: barre da 22 px, due corte da 70 e due lunghe da 122, passo 34,5). Colore: currentColor.
const LogoMark = ({ width = 20, ...props }) => (
  <svg
    role="img"
    aria-label="LiftIndex"
    viewBox="0 0 160 122"
    width={width}
    height={(width * 122) / 160}
    fill="none"
    stroke="currentColor"
    strokeWidth="22"
    strokeLinecap="round"
    {...props}
  >
    <line x1="11" y1="37" x2="11" y2="85" />
    <line x1="45.5" y1="11" x2="45.5" y2="111" />
    <line x1="114.5" y1="11" x2="114.5" y2="111" />
    <line x1="149" y1="37" x2="149" y2="85" />
  </svg>
);

export default LogoMark;
