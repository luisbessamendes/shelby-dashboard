# Professional UI Rules

Common issues that make UI look unprofessional. These are frequently overlooked.

## Icons & Visual Elements

### No Emoji Icons
❌ **Don't:** Use emojis like 🎨 🚀 ⚙️ as UI icons  
✅ **Do:** Use SVG icons from Heroicons, Lucide, or Simple Icons

**Why:** Emojis render differently across platforms and look unprofessional in production UIs.

**Implementation:**
```html
<!-- Bad -->
<div class="icon">🎨</div>

<!-- Good -->
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
</svg>
```

---

### Stable Hover States
❌ **Don't:** Use scale transforms that shift layout  
✅ **Do:** Use color/opacity transitions on hover

**Why:** Layout shifts on hover create jarring user experience.

**Implementation:**
```css
/* Bad - causes layout shift */
.card:hover {
  transform: scale(1.05);
}

/* Good - stable hover */
.card {
  transition: colors 200ms;
}
.card:hover {
  background-color: theme('colors.gray.100');
}
```

---

### Correct Brand Logos
❌ **Don't:** Guess or use incorrect logo paths  
✅ **Do:** Research official SVG from Simple Icons

**Why:** Incorrect logos damage credibility and brand perception.

**Resources:**
- [Simple Icons](https://simpleicons.org/) - Official brand SVGs
- Always verify logo accuracy

---

### Consistent Icon Sizing
❌ **Don't:** Mix different icon sizes randomly  
✅ **Do:** Use fixed viewBox (24x24) with w-6 h-6

**Implementation:**
```html
<!-- Bad - inconsistent -->
<svg class="w-4 h-4" viewBox="0 0 20 20">...</svg>
<svg class="w-8 h-8" viewBox="0 0 24 24">...</svg>

<!-- Good - consistent -->
<svg class="w-6 h-6" viewBox="0 0 24 24">...</svg>
<svg class="w-6 h-6" viewBox="0 0 24 24">...</svg>
```

---

## Interaction & Cursor

### Cursor Pointer
❌ **Don't:** Leave default cursor on interactive elements  
✅ **Do:** Add `cursor-pointer` to all clickable/hoverable cards

**Implementation:**
```html
<!-- Bad -->
<div class="card" onclick="...">

<!-- Good -->
<div class="card cursor-pointer" onclick="...">
```

---

### Hover Feedback
❌ **Don't:** No indication element is interactive  
✅ **Do:** Provide visual feedback (color, shadow, border)

**Implementation:**
```html
<button class="bg-blue-600 hover:bg-blue-700 transition-colors">
  Click me
</button>

<div class="card hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer">
  Interactive card
</div>
```

---

### Smooth Transitions
❌ **Don't:** Instant state changes or too slow (>500ms)  
✅ **Do:** Use `transition-colors duration-200`

**Implementation:**
```css
/* Bad - instant */
.button:hover {
  background-color: blue;
}

/* Bad - too slow */
.button {
  transition: all 1000ms;
}

/* Good - smooth */
.button {
  transition: colors 200ms;
}
```

---

## Light/Dark Mode Contrast

### Glass Card Light Mode
❌ **Don't:** Use `bg-white/10` (too transparent)  
✅ **Do:** Use `bg-white/80` or higher opacity

**Why:** Low opacity makes content unreadable in light mode.

**Implementation:**
```html
<!-- Bad - invisible in light mode -->
<div class="bg-white/10 backdrop-blur-lg">

<!-- Good - visible in both modes -->
<div class="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
```

---

### Text Contrast Light
❌ **Don't:** Use `#94A3B8` (slate-400) for body text  
✅ **Do:** Use `#0F172A` (slate-900) for text

**Why:** WCAG requires 4.5:1 contrast ratio for body text.

**Implementation:**
```html
<!-- Bad - low contrast -->
<p class="text-slate-400">Body text</p>

<!-- Good - sufficient contrast -->
<p class="text-slate-900 dark:text-slate-100">Body text</p>
```

---

### Muted Text Light
❌ **Don't:** Use gray-400 or lighter  
✅ **Do:** Use `#475569` (slate-600) minimum

**Implementation:**
```html
<!-- Bad -->
<p class="text-gray-400">Muted text</p>

<!-- Good -->
<p class="text-slate-600 dark:text-slate-400">Muted text</p>
```

---

### Border Visibility
❌ **Don't:** Use `border-white/10` (invisible)  
✅ **Do:** Use `border-gray-200` in light mode

**Implementation:**
```html
<!-- Bad - invisible in light mode -->
<div class="border border-white/10">

<!-- Good - visible in both modes -->
<div class="border border-gray-200 dark:border-white/10">
```

---

## Layout & Spacing

### Floating Navbar
❌ **Don't:** Stick navbar to `top-0 left-0 right-0`  
✅ **Do:** Add `top-4 left-4 right-4` spacing

**Implementation:**
```html
<!-- Bad - stuck to edges -->
<nav class="fixed top-0 left-0 right-0">

<!-- Good - floating with breathing room -->
<nav class="fixed top-4 left-4 right-4 rounded-2xl">
```

---

### Content Padding
❌ **Don't:** Let content hide behind fixed elements  
✅ **Do:** Account for fixed navbar height

**Implementation:**
```html
<!-- Bad - content hidden -->
<nav class="fixed top-0 h-16">...</nav>
<main>Content starts at top</main>

<!-- Good - content visible -->
<nav class="fixed top-0 h-16">...</nav>
<main class="pt-20">Content below navbar</main>
```

---

### Consistent Max-Width
❌ **Don't:** Mix different container widths  
✅ **Do:** Use same `max-w-6xl` or `max-w-7xl`

**Implementation:**
```html
<!-- Bad - inconsistent -->
<section class="max-w-4xl">...</section>
<section class="max-w-7xl">...</section>

<!-- Good - consistent -->
<section class="max-w-6xl mx-auto">...</section>
<section class="max-w-6xl mx-auto">...</section>
```

---

## Quick Reference Table

| Issue | Don't | Do |
|-------|-------|-----|
| Icons | Emojis 🎨 | SVG from Heroicons/Lucide |
| Hover | `scale(1.05)` | `transition-colors` |
| Cursor | Default on cards | `cursor-pointer` |
| Glass light | `bg-white/10` | `bg-white/80` |
| Text light | `text-slate-400` | `text-slate-900` |
| Borders light | `border-white/10` | `border-gray-200` |
| Navbar | `top-0` stuck | `top-4` floating |
| Container | Mixed widths | Consistent `max-w-6xl` |
