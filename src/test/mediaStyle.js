// jsdom ignora media query e proprietà come gap/justify-content in getComputedStyle: legge le dichiarazioni che un
// elemento riceve da `@media (min-width: Npx)`; xs di MUI è min-width: 0, minWidth null sono le regole base.
export function mediaStyle(el, minWidth = null) {
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
    if (minWidth === null) collect(rules.filter((r) => !r.media));
    else {
      rules.filter((r) => r.media && r.media.mediaText.replace(/\s/g, '').includes(`(min-width:${minWidth}px)`))
        .forEach((r) => collect([...r.cssRules]));
    }
  }
  return found;
}
