# Search Reference

## Available Domains

### product
**Use for:** Product type recommendations

**Example keywords:**
- SaaS, e-commerce, portfolio, healthcare, beauty, service
- dashboard, admin panel, landing page, blog
- fintech, gaming, education, wellness

**Returns:** Style recommendations, color schemes, layout patterns specific to product type

---

### style
**Use for:** UI styles, colors, effects

**Example keywords:**
- glassmorphism, minimalism, dark mode, brutalism
- neumorphism, claymorphism, bento grid
- skeuomorphism, flat design, responsive

**Returns:** Detailed style guide including:
- Color palette recommendations
- Visual effects (shadows, borders, blur)
- Framework-specific implementations
- Best use cases

---

### typography
**Use for:** Font pairings, Google Fonts

**Example keywords:**
- elegant, playful, professional, modern
- luxury, minimal, bold, classic
- tech, creative, corporate

**Returns:**
- Font pairings (header + body)
- Google Fonts import URLs
- Font sizes and weights
- Usage guidelines

---

### color
**Use for:** Color palettes by product type

**Example keywords:**
- saas, ecommerce, healthcare, beauty, fintech, service
- dashboard, portfolio, landing

**Returns:** Complete color palette:
- Primary color
- Secondary color
- CTA (Call-to-Action) color
- Background colors
- Text colors
- Border colors

---

### landing
**Use for:** Page structure, CTA strategies

**Example keywords:**
- hero, hero-centric, testimonial, pricing
- social-proof, feature-grid, comparison

**Returns:**
- Page section structure
- CTA placement strategies
- Content hierarchy
- Conversion optimization tips

---

### chart
**Use for:** Chart types, library recommendations

**Example keywords:**
- trend, comparison, timeline, funnel, pie
- bar, line, area, scatter, heatmap

**Returns:**
- Recommended chart types
- Library suggestions (Chart.js, Recharts, etc.)
- Best practices for data visualization
- Accessibility considerations

---

### ux
**Use for:** Best practices, anti-patterns

**Example keywords:**
- animation, accessibility, z-index, loading
- hover, focus, keyboard, screen-reader
- performance, responsive, mobile

**Returns:**
- Best practices
- Common anti-patterns to avoid
- Implementation guidelines
- Accessibility requirements

---

### prompt
**Use for:** AI prompts, CSS keywords

**Example keywords:** (style names)
- glassmorphism, neumorphism, brutalism
- minimalism, claymorphism

**Returns:**
- AI-ready prompts for generating designs
- CSS keywords and properties
- Implementation snippets

---

## Available Stacks

### html-tailwind (DEFAULT)
**Focus:** Tailwind utilities, responsive design, accessibility

**Best for:**
- Static sites
- Landing pages
- Prototypes
- Quick implementations

**Search examples:**
```bash
python3 scripts/search.py "layout responsive" --stack html-tailwind
python3 scripts/search.py "dark mode" --stack html-tailwind
```

---

### react
**Focus:** State, hooks, performance, patterns

**Best for:**
- SPAs (Single Page Applications)
- Interactive dashboards
- Complex state management

**Search examples:**
```bash
python3 scripts/search.py "state management" --stack react
python3 scripts/search.py "performance" --stack react
```

---

### nextjs
**Focus:** SSR, routing, images, API routes

**Best for:**
- SEO-critical sites
- Full-stack applications
- E-commerce platforms

**Search examples:**
```bash
python3 scripts/search.py "routing" --stack nextjs
python3 scripts/search.py "image optimization" --stack nextjs
```

---

### vue
**Focus:** Composition API, Pinia, Vue Router

**Best for:**
- Progressive web apps
- Admin panels
- Enterprise applications

**Search examples:**
```bash
python3 scripts/search.py "composition api" --stack vue
python3 scripts/search.py "state pinia" --stack vue
```

---

### svelte
**Focus:** Runes, stores, SvelteKit

**Best for:**
- High-performance apps
- Small bundle sizes
- Modern web apps

**Search examples:**
```bash
python3 scripts/search.py "runes state" --stack svelte
python3 scripts/search.py "sveltekit routing" --stack svelte
```

---

### swiftui
**Focus:** Views, State, Navigation, Animation

**Best for:**
- iOS apps
- macOS apps
- Apple ecosystem

**Search examples:**
```bash
python3 scripts/search.py "navigation" --stack swiftui
python3 scripts/search.py "state binding" --stack swiftui
```

---

### react-native
**Focus:** Components, Navigation, Lists

**Best for:**
- Cross-platform mobile apps
- iOS + Android
- Native performance

**Search examples:**
```bash
python3 scripts/search.py "navigation" --stack react-native
python3 scripts/search.py "flatlist performance" --stack react-native
```

---

### flutter
**Focus:** Widgets, State, Layout, Theming

**Best for:**
- Cross-platform mobile apps
- Desktop apps
- Web apps (beta)

**Search examples:**
```bash
python3 scripts/search.py "state management" --stack flutter
python3 scripts/search.py "theming" --stack flutter
```

---

## Search Command Reference

### Basic Search
```bash
python3 scripts/search.py "<keyword>" --domain <domain>
```

### With Max Results
```bash
python3 scripts/search.py "<keyword>" --domain <domain> -n 5
```

### Stack-Specific Search
```bash
python3 scripts/search.py "<keyword>" --stack <stack>
```

### Combined Example
```bash
# Search for glassmorphism style
python3 scripts/search.py "glassmorphism" --domain style

# Search for elegant typography
python3 scripts/search.py "elegant luxury" --domain typography

# Search for SaaS color palette
python3 scripts/search.py "saas" --domain color

# Search for React state management
python3 scripts/search.py "state hooks" --stack react
```

---

## Tips for Effective Searching

### Be Specific
❌ `python3 scripts/search.py "app" --domain product`  
✅ `python3 scripts/search.py "healthcare SaaS dashboard" --domain product`

### Use Multiple Keywords
❌ `python3 scripts/search.py "modern" --domain style`  
✅ `python3 scripts/search.py "modern minimal glassmorphism" --domain style`

### Search Multiple Domains
For complete design system:
1. Product type
2. Style
3. Typography
4. Color
5. UX guidelines
6. Stack specifics

### Iterate
If first search doesn't match expectations:
- Try different keywords
- Search related domains
- Combine results from multiple searches
