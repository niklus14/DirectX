## Design System: MAGNIFICENT ANIMATED LANDING DASHBOARD

### Pattern
- **Name:** AI Personalization Landing
- **Conversion Focus:** 20%+ conversion with personalization. Requires analytics integration. Fallback for new users.
- **CTA Placement:** Context-aware placement based on user segment
- **Color Strategy:** Adaptive based on user data. A/B test color variations per segment.
- **Sections:** 1. Dynamic hero (personalized), 2. Relevant features, 3. Tailored testimonials, 4. Smart CTA

### Style
- **Name:** Social Proof-Focused
- **Keywords:** Testimonials prominent, client logos displayed, case studies sections, reviews/ratings, user avatars, success metrics, credibility markers
- **Best For:** B2B SaaS, professional services, premium products, e-commerce conversion pages, established brands
- **Performance:** ⚡ Good | **Accessibility:** ✓ WCAG AA

### Colors
| Role | Hex |
|------|-----|
| Primary | #0EA5E9 |
| Secondary | #38BDF8 |
| CTA | #F97316 |
| Background | #F0F9FF |
| Text | #0C4A6E |

*Notes: Sky blue trust + warm CTA*

### Typography
- **Heading:** Fira Code
- **Body:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Best For:** Dashboards, analytics, data visualization, admin panels
- **Google Fonts:** https://fonts.google.com/share?selection.family=Fira+Code:wght@400;500;600;700|Fira+Sans:wght@300;400;500;600;700
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Testimonial carousel animations, logo grid fade-in, stat counter animations (number count-up), review star ratings

### Avoid (Anti-patterns)
- Complex navigation
- Hidden contact info

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px

