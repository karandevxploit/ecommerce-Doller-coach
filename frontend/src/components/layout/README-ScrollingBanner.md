# Scrolling Text Banner Components

Modern, smooth, infinite scrolling banner for "DOLLER COACH" brand text.

## Components

### 1. ScrollingTextBanner (Basic)
Simple infinite scroll with edge gradients.

```jsx
import ScrollingTextBanner from "./components/layout/ScrollingTextBanner";

<ScrollingTextBanner 
  text="DOLLER COACH"
  speed={30}  // seconds for one loop
/>
```

### 2. PremiumScrollingBanner (Advanced)
Premium look with blur effects, variable opacity, and diamond separators.

```jsx
import PremiumScrollingBanner from "./components/layout/PremiumScrollingBanner";

<PremiumScrollingBanner 
  text="DOLLER COACH"
  speed={40}
/>
```

### 3. FooterBannerMinimal (Recommended)
Pure Tailwind + Global CSS. Best performance.

```jsx
import { FooterBannerMinimal } from "./components/layout/FooterBanner";

<FooterBannerMinimal />
```

## CSS Classes (Global)

Use these in any component with Tailwind:

```jsx
// Basic scroll animation
<div className="animate-scroll-infinite">
  <span>DOLLER COACH</span>
  <span>DOLLER COACH</span> {/* duplicate for seamless loop */}
</div>

// Speed variants
<div className="animate-scroll-slow">    {/* 50s loop */}
<div className="animate-scroll-infinite"> {/* 30s loop */}
<div className="animate-scroll-fast">     {/* 20s loop */}

// Edge fade masks
<div className="scroll-fade-left">   {/* fade left edge */}
<div className="scroll-fade-right">  {/* fade right edge */}
```

## Features

- ✅ Smooth infinite loop (no jump cuts)
- ✅ Seamless text repeat
- ✅ Medium speed (30s default)
- ✅ Pure CSS animation (no marquee tag)
- ✅ Responsive (slower on mobile)
- ✅ Performance optimized (will-change, transform)
- ✅ Accessibility (pauses on hover, respects prefers-reduced-motion)
- ✅ Premium blur/fade effects
- ✅ Tailwind CSS compatible

## Usage in Footer

```jsx
function Footer() {
  return (
    <footer>
      {/* Other footer content */}
      
      {/* Scrolling banner at bottom */}
      <FooterBannerMinimal />
    </footer>
  );
}
```

## Customization

### Change Speed
```jsx
<ScrollingTextBanner speed={20} />  // faster
<ScrollingTextBanner speed={60} />  // slower
```

### Change Text
```jsx
<ScrollingTextBanner text="YOUR BRAND" />
```

### Custom Styling
```jsx
<ScrollingTextBanner 
  className="bg-black py-12"  // custom background & padding
/>
```
