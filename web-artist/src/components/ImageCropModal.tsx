import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  cropShape: 'round' | 'rect';
  aspect: number;
  onClose: () => void;
  onConfirm: (croppedImage: Blob) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropModal({ isOpen, imageSrc, cropShape, aspect, onClose, onConfirm }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [freeRatio, setFreeRatio] = useState(false);

  // Reset free ratio when modal opens
  useEffect(() => {
    if (isOpen) {
      setFreeRatio(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isOpen]);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: CropArea): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onConfirm(croppedImage);
    } catch (error) {
      console.error('Cropping failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-[600px] mx-4 rounded-2xl border border-white/10 bg-[#1a1412] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            {cropShape === 'round' ? 'Crop Profile Photo' : 'Crop Banner Image'}
          </h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8d7b77] hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-[400px] bg-[#0e0a0a]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={freeRatio ? undefined : aspect}
            cropShape={cropShape}
            showGrid={true}
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: {
                background: '#0e0a0a',
              },
              cropAreaStyle: {
                border: '2px solid #c97a54',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#141010]">
          {/* Free Ratio Toggle for Banner */}
          {cropShape === 'rect' && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <span className="text-[13px] text-[#8d7b77]">Free aspect ratio</span>
              <button
                onClick={() => setFreeRatio(!freeRatio)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  freeRatio ? 'bg-[#c97a54]' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  freeRatio ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          )}

          {/* Zoom Slider */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-[13px] text-[#8d7b77]">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#c97a54]"
            />
          </div>

          {/* Instructions */}
          <div className="text-[12px] text-[#5a4a45] text-center mb-4 space-y-1">
            <p>🖱️ <strong>Drag anywhere</strong> to move the crop area (up, down, left, right)</p>
            <p>🔍 <strong>Scroll or use slider</strong> to zoom in/out</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-[14px] text-[#a99792] hover:bg-white/10 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c97a54] to-[#a85d3c] text-white font-medium text-[14px] shadow-lg shadow-[#c97a54]/25 hover:shadow-[#c97a54]/40 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Apply
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCropModal;
