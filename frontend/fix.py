import os, re

def process_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for pattern, repl in replacements:
        content = re.sub(pattern, repl, content)
    if orig != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated', path)

# 1. Dashboard, Settings, Reviews, ProductPage: catch (err) -> catch
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            path = os.path.join(root, file)
            process_file(path, [(r'catch\s*\(\s*(err|relErr)\s*\)', 'catch')])

# 2. AdminLogin: remove formatError
process_file('src/pages/admin/AdminLogin.jsx', [
    (r'\s*const formatError = .*?;\n\n', '')
])

# 3. ProductCard: remove api, videoRef, isHovered, getCategoryFallback
process_file('src/components/ProductCard.jsx', [
    (r'import\s+\{\s*api\s*\}\s+from\s+.*?;\n', ''),
    (r'import\s+\{\s*getCategoryFallback\s*\}\s+from\s+.*?;\n', ''),
    (r'\s*const\s*\[isHovered,\s*setIsHovered\]\s*=\s*useState\(false\);\n', ''),
    (r'\s*const\s*videoRef\s*=\s*useRef\(null\);\n', '')
])

# 4. QuickSizeSelector: remove product
process_file('src/components/QuickSizeSelector.jsx', [
    (r'({[^}]*)product\s*,', r'\1')
])

# 5. CouponSection: remove subtotal
process_file('src/components/checkout/CouponSection.jsx', [
    (r'({[^}]*)subtotal\s*,', r'\1')
])

# 6. BottomNav: remove snappyTransition
process_file('src/components/layout/BottomNav.jsx', [
    (r'\s*const\s*snappyTransition\s*=\s*\{[^}]*\};\n', '')
])

# 7. Footer: add toast
process_file('src/components/layout/Footer.jsx', [
    (r'(import \{ [^}]* \} from "lucide-react";)', r'\1\nimport toast from "react-hot-toast";')
])

# 8. Checkout: remove formatPrice, fetchUser, errors
process_file('src/pages/Checkout.jsx', [
    (r'\s*const\s*formatPrice\s*=\s*\(.*?;\n', ''),
    (r'\s*const\s*fetchUser\s*=\s*useAuthStore\([^)]*\);\n', ''),
    (r'\s*const\s*\[errors,\s*setErrors\]\s*=\s*useState\(\{.*?\}\);\n', '')
])

# 9. Collection: remove modalTransition, springTransition, scaleIn
process_file('src/pages/Collection.jsx', [
    (r'\s*const\s*(modal|spring)Transition\s*=\s*\{[\s\S]*?\};\n', ''),
    (r'\s*const\s*scaleIn\s*=\s*\{[\s\S]*?\};\n', '')
])

# 10. Home: remove tick
process_file('src/pages/Home.jsx', [
    (r'\s*const\s*\[tick,\s*setTick\]\s*=\s*useState\([0-9]*\);\n', '')
])

# 11. Profile: remove fadeIn, scaleIn
process_file('src/pages/Profile.jsx', [
    (r'\s*const\s*(fadeIn|scaleIn)\s*=\s*\{[\s\S]*?\};\n', '')
])

# 12. ResetPassword: remove setEmail
process_file('src/pages/ResetPassword.jsx', [
    (r'\s*const\s*\[email,\s*setEmail\]\s*=\s*useState\([^)]*\);\n', '')
])

# 13. Wishlist: remove useState, api, mapProduct, toast
process_file('src/pages/Wishlist.jsx', [
    (r'import\s+\{\s*useState\s*\}\s+from\s+[\'"]react[\'"];\n', ''),
    (r'import\s+\{\s*api\s*\}\s+from\s+[\'"]\.\./api/client[\'"];\n', ''),
    (r'import\s+\{\s*mapProduct\s*\}\s+from\s+[\'"]\.\./api/dynamicMapper[\'"];\n', ''),
    (r'import\s+toast\s+from\s+[\'"]react-hot-toast[\'"];\n', '')
])

# 14. ProductPage: remove getCategoryFallback, loadingReviews, setLoadingReviews, canReview
process_file('src/pages/ProductPage.jsx', [
    (r'import\s+\{\s*getCategoryFallback\s*\}\s+from\s+[\'"].*?[\'"];\n', ''),
    (r'\s*const\s*\[loadingReviews,\s*setLoadingReviews\]\s*=\s*useState\([^)]*\);\n', ''),
    (r'\s*const\s*\[canReview,\s*setCanReview\]\s*=\s*useState\([^)]*\);\n', '')
])
