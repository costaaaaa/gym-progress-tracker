// jsdom ignora media query e proprietà come gap/justify-content in getComputedStyle: legge le dichiarazioni che un
// elemento riceve da `@media (min-width: Npx)` (xs di MUI è min-width: 0) o, con bound 'max', da
// `@media (max-width: Npx)`; con width null sono le regole base.
export function mediaStyle(el, width = null, bound = 'min') {
  const classes = [...el.classList];
  const found = {};
  const collect = (rules) => {
    for (const rule of rules) {
      if (classes.some((c) => rule.selectorText === `.${c}`)) {
        for (const prop of rule.style) found[prop] = rule.style.getPropertyValue(prop);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    const rules = [...sheet.cssRules];
    if (width === null) collect(rules.filter((r) => !r.media));
    else {
      rules.filter((r) => r.media && r.media.mediaText.replace(/\s/g, '').includes(`(${bound}-width:${width}px)`))
        .forEach((r) => collect([...r.cssRules]));
    }
  }
  return found;
}
