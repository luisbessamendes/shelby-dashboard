# Pre-Delivery Checklist

Before delivering UI code, verify these items to ensure professional quality.

## Visual Quality

### Icons
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] Brand logos are correct (verified from Simple Icons)
- [ ] Icon sizing is consistent (w-6 h-6 with viewBox="0 0 24 24")

### Colors
- [ ] Use theme colors directly (bg-primary) not var() wrapper
- [ ] Color palette matches product type and industry
- [ ] Colors are accessible (sufficient contrast)

### Visual Effects
- [ ] Hover states don't cause layout shift
- [ ] No scale transforms on hover (use color/opacity instead)
- [ ] Shadows are subtle and consistent
- [ ] Blur effects are performant (backdrop-blur-sm/md/lg)

---

## Interaction

### Cursor & Hover
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Interactive cards have hover effects (shadow, border, or background)

### Transitions
- [ ] Transitions are smooth (150-300ms)
- [ ] Use `transition-colors` not `transition-all`
- [ ] No transitions slower than 500ms

### Focus States
- [ ] Focus states visible for keyboard navigation
- [ ] Focus rings are accessible (not removed with `outline-none` without replacement)

---

## Light/Dark Mode

### Light Mode
- [ ] Light mode text has sufficient contrast (4.5:1 minimum)
- [ ] Glass/transparent elements visible in light mode (`bg-white/80` minimum)
- [ ] Borders visible in light mode (`border-gray-200` not `border-white/10`)
- [ ] Body text uses `text-slate-900` not `text-slate-400`
- [ ] Muted text uses `text-slate-600` minimum

### Dark Mode
- [ ] Dark mode text has sufficient contrast
- [ ] Glass elements use appropriate opacity (`bg-gray-900/80`)
- [ ] Borders visible in dark mode (`border-white/10`)

### Testing
- [ ] Test both modes before delivery
- [ ] Verify all elements are readable in both modes
- [ ] Check hover states in both modes

---

## Layout

### Spacing
- [ ] Floating elements have proper spacing from edges (`top-4 left-4 right-4`)
- [ ] No content hidden behind fixed navbars (add `pt-20` or similar)
- [ ] Consistent max-width across sections (`max-w-6xl` or `max-w-7xl`)

### Responsive
- [ ] Responsive at 320px (mobile)
- [ ] Responsive at 768px (tablet)
- [ ] Responsive at 1024px (desktop)
- [ ] Responsive at 1440px (large desktop)
- [ ] No horizontal scroll on mobile

### Grid & Flexbox
- [ ] Grids collapse properly on mobile
- [ ] Flex items wrap appropriately
- [ ] Spacing is consistent across breakpoints

---

## Accessibility

### Semantic HTML
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Headings follow logical hierarchy (h1 → h2 → h3)

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical
- [ ] Focus states are visible

### Color & Contrast
- [ ] Color is not the only indicator (use icons/text too)
- [ ] Text contrast meets WCAG AA (4.5:1 for body, 3:1 for large text)
- [ ] Interactive elements have sufficient contrast

### Motion
- [ ] `prefers-reduced-motion` respected
- [ ] Animations can be disabled
- [ ] No auto-playing videos without controls

---

## Performance

### Images
- [ ] Images are optimized (WebP/AVIF when possible)
- [ ] Images have width/height attributes
- [ ] Lazy loading enabled for below-fold images

### CSS
- [ ] No unused CSS classes
- [ ] Tailwind purge is configured correctly
- [ ] Critical CSS is inlined (if applicable)

### JavaScript
- [ ] No console.log statements
- [ ] No unused imports
- [ ] Bundle size is reasonable

---

## Content

### Typography
- [ ] Font pairings are intentional (not default Arial)
- [ ] Font sizes follow hierarchy (36-44pt titles, 14-16pt body)
- [ ] Line height is readable (1.5-1.75 for body text)

### Copy
- [ ] No placeholder text (Lorem ipsum, "Click here", etc.)
- [ ] CTAs are clear and actionable
- [ ] Error messages are helpful

---

## Quick Verification Commands

### Check for Common Issues
```bash
# Check for emojis in code
grep -r "🎨\|🚀\|⚙️" src/

# Check for scale transforms
grep -r "scale(" src/

# Check for missing cursor-pointer
grep -r "onclick\|@click" src/ | grep -v "cursor-pointer"

# Check for low opacity in light mode
grep -r "bg-white/10\|bg-white/20" src/
```

### Visual Testing
1. Open in browser
2. Toggle dark mode
3. Resize to 320px, 768px, 1024px, 1440px
4. Tab through interactive elements
5. Test hover states
6. Check console for errors

---

## Final Sign-Off

Before marking as complete:

- [ ] All checklist items verified
- [ ] Tested in both light and dark mode
- [ ] Tested at all breakpoints
- [ ] No console errors or warnings
- [ ] Code is clean and readable
- [ ] Ready for production deployment
