export function getOptimizedImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;
  
  // Inject transformation after /upload/
  // w_300,h_300: width and height set to 300px
  // c_fill: focus and crop to fill the dimensions
  // q_auto: automatic quality optimization
  // f_auto: automatic format selection (WebP, AVIF, etc.)
  return url.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/');
}
