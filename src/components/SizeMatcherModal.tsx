import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, 
  Search, 
  RotateCcw, 
  Info, 
  Sparkles, 
  Move, 
  Scale, 
  Sliders, 
  Check, 
  HelpCircle, 
  LayoutGrid, 
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Hand,
  RotateCw
} from 'lucide-react';
import { Product } from '../types';

interface SizeMatcherModalProps {
  products: Product[];
  onClose: () => void;
}

type MatchMode = 'height' | 'diameter';
type UnitType = 'mm' | 'inch';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// ----------------------------------------------------------------------
// AutoSizingCanvas: Sub-component that manages its parent container's dimensions
// via ResizeObserver to ensure crisp 1:1 pixel rendering with zero stretching.
// ----------------------------------------------------------------------
interface AutoSizingCanvasProps {
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  className?: string;
}

function AutoSizingCanvas({ onDraw, className = "" }: AutoSizingCanvasProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 400, height: 300 });

  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      const w = Math.max(100, Math.floor(width));
      const h = Math.max(100, Math.floor(height));
      setSize({ width: w, height: h });
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    onDraw(ctx, size.width, size.height);
  }, [size, onDraw]);

  return (
    <div ref={parentRef} className={`w-full h-full relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="absolute inset-0 block w-full h-full"
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Main SizeMatcherModal component
// ----------------------------------------------------------------------
export default function SizeMatcherModal({ products, onClose }: SizeMatcherModalProps) {
  const [mode, setMode] = useState<MatchMode>('diameter');
  const [inputUnit, setInputUnit] = useState<UnitType>('mm');

  // Interactive UI configurations
  const [isOverlayMode, setIsOverlayMode] = useState<boolean>(true);
  const [alignmentOffset, setAlignmentOffset] = useState<number>(30); // 3D separation displacement
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // Interactive Zoom Level (0.3x - 3.0x)
  const [shapeVisibility, setShapeVisibility] = useState<number>(0.8); // Range: 0.5 (50% visible) to 1.0 (100% visible)
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(false);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');

  // Selected products for metadata mapping
  const [selectedProductA, setSelectedProductA] = useState<Product | null>(null);
  const [selectedProductB, setSelectedProductB] = useState<Product | null>(null);

  // Search filter query string states
  const [searchA, setSearchA] = useState('');
  const [showDropdownA, setShowDropdownA] = useState(false);

  const [searchB, setSearchB] = useState('');
  const [showDropdownB, setShowDropdownB] = useState(false);

  // Raw string inputs to preserve decimal places when typing e.g. "3." or "0.05"
  const [rawHeightA, setRawHeightA] = useState('100');
  const [rawOdA, setRawOdA] = useState('80');
  const [rawIdA, setRawIdA] = useState('60');

  const [rawHeightB, setRawHeightB] = useState('90');
  const [rawOdB, setRawOdB] = useState('75');
  const [rawIdB, setRawIdB] = useState('55');

  // Convert mm to active unit
  const fromMm = (val: number, unit: UnitType) => {
    return unit === 'inch' ? val / 25.4 : val;
  };

  // Convert active unit to mm
  const toMm = (val: number, unit: UnitType) => {
    return unit === 'inch' ? val * 25.4 : val;
  };

  // Handle unit switcher gracefully without modifying internal measurements, just converting active input views
  const handleUnitSwitch = (newUnit: UnitType) => {
    if (newUnit === inputUnit) return;

    const parseVal = (str: string) => {
      const parsed = parseFloat(str);
      return isNaN(parsed) ? 0 : parsed;
    };

    const valHA = parseVal(rawHeightA);
    const valOdA = parseVal(rawOdA);
    const valIdA = parseVal(rawIdA);

    const valHB = parseVal(rawHeightB);
    const valOdB = parseVal(rawOdB);
    const valIdB = parseVal(rawIdB);

    if (newUnit === 'inch') {
      // mm to inch
      setRawHeightA((valHA / 25.4).toFixed(3));
      setRawOdA((valOdA / 25.4).toFixed(3));
      setRawIdA((valIdA / 25.4).toFixed(3));

      setRawHeightB((valHB / 25.4).toFixed(3));
      setRawOdB((valOdB / 25.4).toFixed(3));
      setRawIdB((valIdB / 25.4).toFixed(3));
    } else {
      // inch to mm
      setRawHeightA((valHA * 25.4).toFixed(1));
      setRawOdA((valOdA * 25.4).toFixed(1));
      setRawIdA((valIdA * 25.4).toFixed(1));

      setRawHeightB((valHB * 25.4).toFixed(1));
      setRawOdB((valOdB * 25.4).toFixed(1));
      setRawIdB((valIdB * 25.4).toFixed(1));
    }

    setInputUnit(newUnit);
  };

  // Safe decimal string inputs regex handler
  const handleRawInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setter(value);
    }
  };

  // Resolve numerical specs in real-time
  const specs = useMemo(() => {
    const parse = (v: string) => parseFloat(v) || 0;

    const valHeightA = parse(rawHeightA);
    const valOdA = parse(rawOdA);
    const valIdA = parse(rawIdA);

    const valHeightB = parse(rawHeightB);
    const valOdB = parse(rawOdB);
    const valIdB = parse(rawIdB);

    // Dynamic measurements mapped to standard internal MM sizing for physics rendering
    return {
      a: {
        height: inputUnit === 'inch' ? valHeightA * 25.4 : valHeightA,
        od: inputUnit === 'inch' ? valOdA * 25.4 : valOdA,
        id: inputUnit === 'inch' ? valIdA * 25.4 : valIdA,
        rawHeight: valHeightA,
        rawOd: valOdA,
        rawId: valIdA
      },
      b: {
        height: inputUnit === 'inch' ? valHeightB * 25.4 : valHeightB,
        od: inputUnit === 'inch' ? valOdB * 25.4 : valOdB,
        id: inputUnit === 'inch' ? valIdB * 25.4 : valIdB,
        rawHeight: valHeightB,
        rawOd: valOdB,
        rawId: valIdB
      }
    };
  }, [rawHeightA, rawOdA, rawIdA, rawHeightB, rawOdB, rawIdB, inputUnit]);

  // Loading existing inventory items
  const handleSelectProduct = (panel: 'A' | 'B', product: Product) => {
    let h_mm = product.height_mm || (product.length_inch ? product.length_inch * 25.4 : 80);
    let od_mm = product.od_mm || (product.width_inch ? product.width_inch * 25.4 : 70);
    let id_mm = product.gasket_id_mm || (product.inner_diameter_inch ? product.inner_diameter_inch * 25.4 : (product.gasket_od_mm ? product.gasket_od_mm * 0.85 : 0));

    if (panel === 'A') {
      setSelectedProductA(product);
      setSearchA(product.part_number);
      setShowDropdownA(false);

      if (inputUnit === 'inch') {
        setRawHeightA((h_mm / 25.4).toFixed(3));
        setRawOdA((od_mm / 25.4).toFixed(3));
        setRawIdA((id_mm / 25.4).toFixed(3));
      } else {
        setRawHeightA(h_mm.toFixed(1));
        setRawOdA(od_mm.toFixed(1));
        setRawIdA(id_mm.toFixed(1));
      }
    } else {
      setSelectedProductB(product);
      setSearchB(product.part_number);
      setShowDropdownB(false);

      if (inputUnit === 'inch') {
        setRawHeightB((h_mm / 25.4).toFixed(3));
        setRawOdB((od_mm / 25.4).toFixed(3));
        setRawIdB((id_mm / 25.4).toFixed(3));
      } else {
        setRawHeightB(h_mm.toFixed(1));
        setRawOdB(od_mm.toFixed(1));
        setRawIdB(id_mm.toFixed(1));
      }
    }
  };

  // Dropdown list filters
  const filteredProductsA = useMemo(() => {
    if (!searchA) return products.slice(0, 10);
    return products.filter(p => 
      p.part_number.toLowerCase().includes(searchA.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchA.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchA.toLowerCase()))
    ).slice(0, 10);
  }, [searchA, products]);

  const filteredProductsB = useMemo(() => {
    if (!searchB) return products.slice(0, 10);
    return products.filter(p => 
      p.part_number.toLowerCase().includes(searchB.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchB.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchB.toLowerCase()))
    ).slice(0, 10);
  }, [searchB, products]);

  // Rotational coordinates for 3D Camera Orbit
  const [angleX, setAngleX] = useState<number>(-0.45); // Pitch (Vertical rotation)
  const [angleY, setAngleY] = useState<number>(0.75);  // Yaw (Horizontal rotation)
  const isDragging = useRef(false);
  const dragActiveType = useRef<'rotate' | 'pan'>('rotate');
  const lastMousePos = useRef({ x: 0, y: 0 });
 
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || e.shiftKey || dragMode === 'pan') {
      dragActiveType.current = 'pan';
    } else {
      dragActiveType.current = 'rotate';
    }
  };
 
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    
    if (dragActiveType.current === 'pan') {
      setPanX(prev => prev + deltaX);
      setPanY(prev => prev + deltaY);
    } else {
      setAngleY(prev => prev + deltaX * 0.008);
      setAngleX(prev => Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, prev + deltaY * 0.008)));
    }
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };
 
  const handleMouseUp = () => {
    isDragging.current = false;
  };
 
  const handleWheel = (e: React.WheelEvent) => {
    // Scroll wheel zoom multiplier
    const delta = -e.deltaY;
    if (delta > 0) {
      setZoomLevel(prev => Math.min(8.0, prev + 0.08));
    } else {
      setZoomLevel(prev => Math.max(0.15, prev - 0.08));
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Helper to convert HEX to RGBA with custom visibility scale
  const getRGBA = useCallback((hex: string, baseOpacity: number) => {
    let opacity = baseOpacity;
    if (shapeVisibility <= 0.8) {
      // Scale from 0.5 * baseOpacity (at 0.5) to baseOpacity (at 0.8)
      const t = (shapeVisibility - 0.5) / 0.3; // 0 to 1
      opacity = baseOpacity * (0.5 + 0.5 * t);
    } else {
      // Scale from baseOpacity (at 0.8) to 1.0 (at 1.0)
      const t = (shapeVisibility - 0.8) / 0.2; // 0 to 1
      opacity = baseOpacity + (1.0 - baseOpacity) * t;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
  }, [shapeVisibility]);

  const getStrokeRGBA = useCallback((hex: string, baseOpacity: number = 1.0) => {
    let opacity = baseOpacity;
    if (shapeVisibility < 0.8) {
      const t = (shapeVisibility - 0.5) / 0.3; // 0 to 1
      opacity = baseOpacity * (0.6 + 0.4 * t);
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
  }, [shapeVisibility]);

  // Compute 3D scaling metrics based on current mm dimensions
  const renderScale = useMemo(() => {
    const maxVal = Math.max(
      specs.a.height, specs.b.height,
      specs.a.od, specs.b.od,
      specs.a.id, specs.b.id,
      30
    );
    // Standard size: maximum element fits within 130 scaling pixels safely
    return (130 / maxVal) * zoomLevel;
  }, [specs, zoomLevel]);

  // Compatibility Metrics
  const metrics = useMemo(() => {
    const dHeight = Math.abs(specs.a.height - specs.b.height);
    const dOd = Math.abs(specs.a.od - specs.b.od);
    const dId = Math.abs(specs.a.id - specs.b.id);

    let verdict = 'Compatible Sizing';
    let colorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
    let statusBadge = 'Perfect Alignment';
    let desc = 'Both components display matching specifications. Sealing fits are guaranteed.';

    if (mode === 'height') {
      if (dHeight === 0) {
        verdict = 'Perfect Height Match';
        colorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
        statusBadge = 'PASS';
        desc = 'Product heights align perfectly down to a millimeter.';
      } else if (dHeight < 2) {
        verdict = 'Near-Perfect Match';
        colorClass = 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
        statusBadge = 'COMPATIBLE';
        desc = `Negligible height difference of ${fromMm(dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} ${inputUnit}. Gaskets or housing units will absorb this.`;
      } else if (dHeight < 10) {
        verdict = 'Tolerable Variance';
        colorClass = 'bg-amber-950/80 text-amber-300 border-amber-800';
        statusBadge = 'WARNING';
        desc = `Height deviation is ${fromMm(dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} ${inputUnit}. Verify that housing mounts have extra clearance.`;
      } else {
        verdict = 'Height Mismatch';
        colorClass = 'bg-rose-950/80 text-rose-300 border-rose-800';
        statusBadge = 'MISMATCH';
        desc = `Severe height variance of ${fromMm(dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} ${inputUnit}. Double check filter housing tolerances.`;
      }
    } else {
      // Diameter/Gasket comparisons
      if (dOd === 0 && dId === 0) {
        verdict = 'Identical Ring Specs';
        colorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
        statusBadge = 'PASS';
        desc = 'Both inner and outer gasket rims line up flawlessly.';
      } else if (dOd < 1.5 && dId < 1.5) {
        verdict = 'Tolerable Fit';
        colorClass = 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
        statusBadge = 'COMPATIBLE';
        desc = `Tiny variance (OD Δ: ${fromMm(dOd, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} / ID Δ: ${fromMm(dId, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)}). Fits should compress correctly.`;
      } else if (specs.b.od < specs.a.id) {
        verdict = 'Nesting Compatibility';
        colorClass = 'bg-indigo-950/80 text-indigo-300 border-indigo-850';
        statusBadge = 'NESTED FIT';
        desc = `Product B (OD: ${fromMm(specs.b.od, inputUnit).toFixed(inputUnit === 'inch' ? 2 : 1)} ${inputUnit}) is small enough to fit completely inside Product A's central gasket core (ID: ${fromMm(specs.a.id, inputUnit).toFixed(inputUnit === 'inch' ? 2 : 1)} ${inputUnit})!`;
      } else if (specs.a.od < specs.b.id) {
        verdict = 'Nesting Compatibility';
        colorClass = 'bg-indigo-950/80 text-indigo-300 border-indigo-850';
        statusBadge = 'NESTED FIT';
        desc = `Product A (OD: ${fromMm(specs.a.od, inputUnit).toFixed(inputUnit === 'inch' ? 2 : 1)} ${inputUnit}) is small enough to fit completely inside Product B's central gasket core (ID: ${fromMm(specs.b.id, inputUnit).toFixed(inputUnit === 'inch' ? 2 : 1)} ${inputUnit})!`;
      } else {
        verdict = 'Spec Mismatch';
        colorClass = 'bg-rose-950/80 text-rose-300 border-rose-800';
        statusBadge = 'MISMATCH';
        desc = `Rims do not align. OD differs by ${fromMm(dOd, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} ${inputUnit}, ID differs by ${fromMm(dId, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} ${inputUnit}. Leakage is highly probable.`;
      }
    }

    return { dHeight, dOd, dId, verdict, colorClass, statusBadge, desc };
  }, [mode, specs, inputUnit]);

  // Core 3D engine drawing routine (projection mapping)
  const render3DShape = useCallback((
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    shapeMode: MatchMode,
    hValue: number,
    odValue: number,
    idValue: number,
    colorHex: string,
    offsetX: number = 0,
    offsetY: number = 0
  ) => {
    const scale = renderScale;

    // 3D Point Projection to 2D Screen
    const project = (pt: Point3D) => {
      // Rotate Yaw (around Y axis)
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const x1 = pt.x * cosY - pt.z * sinY;
      const z1 = pt.x * sinY + pt.z * cosY;

      // Rotate Pitch (around X axis)
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const y2 = pt.y * cosX - z1 * sinX;
      const z2 = pt.y * sinX + z1 * cosX;

      // Perspective correction
      const cameraDepth = 360;
      const factor = cameraDepth / (cameraDepth + z2);

      return {
        x: w / 2 + x1 * scale * factor + offsetX + panX,
        y: h / 2 + y2 * scale * factor + offsetY + panY,
        depth: z2
      };
    };

    if (shapeMode === 'height') {
      // Draw rectangular solid box
      const boxW = 38;
      const boxD = 38;
      const dy = hValue / 2;

      const vertices: Point3D[] = [
        { x: -boxW, y: -dy, z: -boxD }, // 0: Top-Back-Left
        { x: boxW, y: -dy, z: -boxD },  // 1: Top-Back-Right
        { x: boxW, y: -dy, z: boxD },   // 2: Top-Front-Right
        { x: -boxW, y: -dy, z: boxD },  // 3: Top-Front-Left
        { x: -boxW, y: dy, z: -boxD },   // 4: Bottom-Back-Left
        { x: boxW, y: dy, z: -boxD },    // 5: Bottom-Back-Right
        { x: boxW, y: dy, z: boxD },     // 6: Bottom-Front-Right
        { x: -boxW, y: dy, z: boxD }      // 7: Bottom-Front-Left
      ];

      const projected = vertices.map(project);

      // Painter's faces
      const faces = [
        { indices: [0, 1, 2, 3], fill: getRGBA(colorHex, 0.208), stroke: getStrokeRGBA(colorHex, 1.0), name: 'top' },
        { indices: [4, 5, 6, 7], fill: getRGBA(colorHex, 0.145), stroke: getStrokeRGBA(colorHex, 1.0), name: 'bottom' },
        { indices: [0, 3, 7, 4], fill: getRGBA(colorHex, 0.165), stroke: getStrokeRGBA(colorHex, 1.0), name: 'left' },
        { indices: [1, 2, 6, 5], fill: getRGBA(colorHex, 0.188), stroke: getStrokeRGBA(colorHex, 1.0), name: 'right' },
        { indices: [2, 3, 7, 6], fill: getRGBA(colorHex, 0.251), stroke: getStrokeRGBA(colorHex, 1.0), name: 'front' },
        { indices: [0, 1, 5, 4], fill: getRGBA(colorHex, 0.094), stroke: getStrokeRGBA(colorHex, 1.0), name: 'back' }
      ];

      // Depth sort faces
      const sortedFaces = faces.map(face => {
        const avgDepth = face.indices.reduce((sum, idx) => sum + projected[idx].depth, 0) / 4;
        return { ...face, avgDepth };
      }).sort((a, b) => b.avgDepth - a.avgDepth);

      sortedFaces.forEach(face => {
        ctx.beginPath();
        ctx.moveTo(projected[face.indices[0]].x, projected[face.indices[0]].y);
        for (let i = 1; i < face.indices.length; i++) {
          ctx.lineTo(projected[face.indices[i]].x, projected[face.indices[i]].y);
        }
        ctx.closePath();

        ctx.fillStyle = face.fill;
        ctx.fill();
        ctx.strokeStyle = face.stroke;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
    } else {
      // Cylinder / Ring structure
      const rOuter = odValue / 2;
      const rInner = idValue / 2;
      const dy = hValue / 2;

      // Subdivision approximations
      const segments = 28;
      const topOuter: Point3D[] = [];
      const topInner: Point3D[] = [];
      const botOuter: Point3D[] = [];
      const botInner: Point3D[] = [];

      for (let s = 0; s < segments; s++) {
        const theta = (s * 2 * Math.PI) / segments;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        topOuter.push({ x: rOuter * cos, y: -dy, z: rOuter * sin });
        topInner.push({ x: rInner * cos, y: -dy, z: rInner * sin });
        botOuter.push({ x: rOuter * cos, y: dy, z: rOuter * sin });
        botInner.push({ x: rInner * cos, y: dy, z: rInner * sin });
      }

      const pTopOuter = topOuter.map(project);
      const pTopInner = topInner.map(project);
      const pBotOuter = botOuter.map(project);
      const pBotInner = botInner.map(project);

      interface DrawJob {
        depth: number;
        draw: () => void;
      }

      const jobs: DrawJob[] = [];

      // Generate side segments
      for (let s = 0; s < segments; s++) {
        const next = (s + 1) % segments;

        // Outer wall slice
        const oDepth = (pTopOuter[s].depth + pTopOuter[next].depth + pBotOuter[next].depth + pBotOuter[s].depth) / 4;
        jobs.push({
          depth: oDepth,
          draw: () => {
            ctx.beginPath();
            ctx.moveTo(pTopOuter[s].x, pTopOuter[s].y);
            ctx.lineTo(pTopOuter[next].x, pTopOuter[next].y);
            ctx.lineTo(pBotOuter[next].x, pBotOuter[next].y);
            ctx.lineTo(pBotOuter[s].x, pBotOuter[s].y);
            ctx.closePath();
            ctx.fillStyle = getRGBA(colorHex, 0.125);
            ctx.fill();
            ctx.strokeStyle = getStrokeRGBA(colorHex, 0.667);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // Inner wall slice
        if (rInner > 0) {
          const iDepth = (pTopInner[s].depth + pTopInner[next].depth + pBotInner[next].depth + pBotInner[s].depth) / 4;
          jobs.push({
            depth: iDepth,
            draw: () => {
              ctx.beginPath();
              ctx.moveTo(pTopInner[s].x, pTopInner[s].y);
              ctx.lineTo(pTopInner[next].x, pTopInner[next].y);
              ctx.lineTo(pBotInner[next].x, pBotInner[next].y);
              ctx.lineTo(pBotInner[s].x, pBotInner[s].y);
              ctx.closePath();
              ctx.fillStyle = getRGBA(colorHex, 0.157);
              ctx.fill();
              ctx.strokeStyle = getStrokeRGBA(colorHex, 0.467);
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          });
        }
      }

      // Add top capping ring
      const topDepth = pTopOuter.reduce((sum, p) => sum + p.depth, 0) / segments;
      jobs.push({
        depth: topDepth - 5, // slightly closer to overlay wall segments cleanly
        draw: () => {
          ctx.beginPath();
          // Outer path (clockwise)
          ctx.moveTo(pTopOuter[0].x, pTopOuter[0].y);
          for (let s = 1; s < segments; s++) {
            ctx.lineTo(pTopOuter[s].x, pTopOuter[s].y);
          }
          ctx.closePath();

          if (rInner > 0) {
            // Inner path (counter-clockwise to punch hole)
            ctx.moveTo(pTopInner[0].x, pTopInner[0].y);
            for (let s = segments - 1; s >= 0; s--) {
              ctx.lineTo(pTopInner[s].x, pTopInner[s].y);
            }
            ctx.closePath();
          }

          ctx.fillStyle = getRGBA(colorHex, 0.208);
          ctx.fill('evenodd');
          ctx.strokeStyle = getStrokeRGBA(colorHex, 1.0);
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Stroke inner rim
          if (rInner > 0) {
            ctx.beginPath();
            ctx.moveTo(pTopInner[0].x, pTopInner[0].y);
            for (let s = 1; s < segments; s++) {
              ctx.lineTo(pTopInner[s].x, pTopInner[s].y);
            }
            ctx.closePath();
            ctx.strokeStyle = getStrokeRGBA(colorHex, 1.0);
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      });

      // Add bottom cap ring
      const botDepth = pBotOuter.reduce((sum, p) => sum + p.depth, 0) / segments;
      jobs.push({
        depth: botDepth + 5,
        draw: () => {
          ctx.beginPath();
          ctx.moveTo(pBotOuter[0].x, pBotOuter[0].y);
          for (let s = 1; s < segments; s++) {
            ctx.lineTo(pBotOuter[s].x, pBotOuter[s].y);
          }
          ctx.closePath();

          if (rInner > 0) {
            ctx.moveTo(pBotInner[0].x, pBotInner[0].y);
            for (let s = segments - 1; s >= 0; s--) {
              ctx.lineTo(pBotInner[s].x, pBotInner[s].y);
            }
            ctx.closePath();
          }

          ctx.fillStyle = getRGBA(colorHex, 0.082);
          ctx.fill('evenodd');
          ctx.strokeStyle = getStrokeRGBA(colorHex, 0.533);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });

      // Execute drawn objects sorted back-to-front
      jobs.sort((a, b) => b.depth - a.depth).forEach(j => j.draw());
    }
  }, [renderScale, angleX, angleY, getRGBA, getStrokeRGBA, panX, panY]);

  // Grid background drawing
  const drawGridBg = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid layout lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 0.8;
    const gridSize = 25;
    
    // Slide grid lines infinitely using modulo arithmetic
    const shiftX = panX % gridSize;
    const shiftY = panY % gridSize;

    for (let x = shiftX; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = shiftY; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Modern glowing linear indicator in center matching the panning center
    const grad = ctx.createRadialGradient(w / 2 + panX, h / 2 + panY, 20, w / 2 + panX, h / 2 + panY, Math.max(w, h) * 0.55);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.08)'); // subtle emerald pulse
    grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.03)'); // subtle ocean light
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, [panX, panY]);

  // Combined Drawer: Canvas A Split
  const onDrawSplitA = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawGridBg(ctx, w, h);
    render3DShape(
      ctx, w, h, mode, 
      specs.a.height, specs.a.od, specs.a.id, 
      '#38bdf8' // Sky blue
    );
    // Draw viewport tags
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText(`🔷 PRODUCT A (${selectedProductA ? selectedProductA.part_number : 'MANUAL'})`, 15, 25);
  }, [drawGridBg, render3DShape, mode, specs.a, selectedProductA]);

  // Combined Drawer: Canvas B Split
  const onDrawSplitB = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawGridBg(ctx, w, h);
    render3DShape(
      ctx, w, h, mode, 
      specs.b.height, specs.b.od, specs.b.id, 
      '#fbbf24' // Neon amber
    );
    // Draw tags
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText(`🔶 PRODUCT B (${selectedProductB ? selectedProductB.part_number : 'MANUAL'})`, 15, 25);
  }, [drawGridBg, render3DShape, mode, specs.b, selectedProductB]);

  // Combined Drawer: Overlay Workspace
  const onDrawOverlay = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawGridBg(ctx, w, h);

    // Calculate separation pixel offset vector (separate left-right)
    const displacement = alignmentOffset * 1.5;
    const xOffsetA = -displacement;
    const xOffsetB = displacement;

    // Draw Shape A
    render3DShape(
      ctx, w, h, mode,
      specs.a.height, specs.a.od, specs.a.id,
      '#38bdf8', // Neon Sky Blue
      xOffsetA,
      0
    );

    // Draw Shape B
    render3DShape(
      ctx, w, h, mode,
      specs.b.height, specs.b.od, specs.b.id,
      '#fbbf24', // Neon Amber Gold
      xOffsetB,
      0
    );

    // Subtitle coordinates tracking info
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const pitchDeg = (angleX * (180 / Math.PI)).toFixed(0);
    const yawDeg = (angleY * (180 / Math.PI)).toFixed(0);
    ctx.fillText(`ROTATION PITCH: ${pitchDeg}°  |  YAW: ${yawDeg}°`, 15, h - 15);

    // Overlay Tag info
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('⚡ INTERACTIVE CONCENTRIC SEALS SIMULATOR', 15, 25);
  }, [drawGridBg, render3DShape, mode, specs, alignmentOffset, angleX, angleY]);

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen flex flex-col bg-[#030712] text-slate-100 overflow-hidden font-sans">
      
      {/* 1. Header Bar */}
      <header className="bg-[#0b0f19] border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2 rounded-lg text-white shadow-md shadow-emerald-900/30">
            <Scale className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-base tracking-wide uppercase text-slate-100">
                3D Size Matcher & Proportional Sandbox
              </h2>
              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                System Live
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Interact, overlay, and detect dimensional alignment tolerances for seal parts in full-screen visualization
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300 transition-colors shadow-inner flex items-center justify-center cursor-pointer"
          title="Exit Simulator"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT CONTROL SIDE-PANEL */}
        <section className={`w-full lg:w-[390px] bg-[#0b0f19] border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 p-5 space-y-5 ${isSidebarHidden ? 'hidden lg:hidden' : ''}`}>
          
          {/* A. Global Settings Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-4 shadow-sm">
            <h4 className="text-[10px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              SIMULATION CONFIGURATION
            </h4>
            
            {/* Mode Switcher */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comparison Mode</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setMode('diameter')}
                  className={`py-2 text-[10.5px] font-black uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                    mode === 'diameter'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  ⭕ OD / ID Rim
                </button>
                <button
                  onClick={() => setMode('height')}
                  className={`py-2 text-[10.5px] font-black uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                    mode === 'height'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  📊 Height
                </button>
              </div>
            </div>

            {/* Input Unit Selector Option */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Input & View Unit</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => handleUnitSwitch('mm')}
                  className={`py-1.5 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                    inputUnit === 'mm'
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Millimeters (mm)
                </button>
                <button
                  onClick={() => handleUnitSwitch('inch')}
                  className={`py-1.5 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                    inputUnit === 'inch'
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Inches (in)
                </button>
              </div>
            </div>

            {/* Screen layout switches */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Viewport Alignment</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setIsOverlayMode(true)}
                  className={`py-1.5 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                    isOverlayMode
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Overlay</span>
                </button>
                <button
                  onClick={() => setIsOverlayMode(false)}
                  className={`py-1.5 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                    !isOverlayMode
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* Shape Transparency / Visibility Slider */}
            <div className="space-y-2 border-t border-slate-800/85 pt-3">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Shape Visibility</span>
                <span className="text-emerald-400 font-mono font-bold text-[10.5px]">
                  {Math.round(shapeVisibility * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">50% Translucent</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={shapeVisibility}
                  onChange={(e) => setShapeVisibility(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer border border-slate-800 focus:outline-none"
                />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">100% Solid</span>
              </div>
              <div className="text-[8.5px] text-slate-500 font-medium italic">
                * Adjust shapes from semi-transparent (50%) to fully solid/opaque (100%).
              </div>
            </div>
          </div>

          {/* B. Component A specs */}
          <div className="border-l-4 border-sky-500 bg-sky-950/15 border border-slate-800/80 p-4 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-extrabold text-sky-400 flex items-center gap-1.5">
                🔷 PART A (SKY BLUE)
              </span>
              <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-900 font-black px-1.5 py-0.5 rounded uppercase">
                A Component
              </span>
            </div>

            {/* Search Dropdown from database */}
            <div className="relative">
              <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Load Part Specs from Inventory
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchA}
                  onChange={(e) => {
                    setSearchA(e.target.value);
                    setShowDropdownA(true);
                  }}
                  onFocus={() => setShowDropdownA(true)}
                  placeholder="Search brand, part number..."
                  className="w-full bg-[#030712] pl-8 pr-8 py-2 text-xs border border-slate-700 rounded focus:outline-none focus:border-sky-500 text-slate-100"
                />
                {searchA && (
                  <button 
                    onClick={() => {
                      setSearchA('');
                      setSelectedProductA(null);
                    }} 
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {showDropdownA && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg shadow-2xl z-20 max-h-48 overflow-y-auto text-xs divide-y divide-slate-800">
                  <div className="p-1.5 text-[8.5px] bg-[#030712] text-slate-450 uppercase font-black tracking-widest text-center">
                    Select Database Filter
                  </div>
                  {filteredProductsA.length === 0 ? (
                    <div className="p-3 text-slate-500 text-center font-semibold">No filters match</div>
                  ) : (
                    filteredProductsA.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct('A', p)}
                        className="p-2.5 hover:bg-sky-950/40 cursor-pointer flex flex-col transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-100 text-[11px]">{p.part_number}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-black">{p.brand}</span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 mt-1 truncate">
                          {p.category || 'General Filter'} {p.height_mm ? `| H: ${p.height_mm}mm` : ''} {p.od_mm ? `| OD: ${p.od_mm}mm` : ''}
                        </div>
                      </div>
                    ))
                  )}
                  <div 
                    onClick={() => setShowDropdownA(false)} 
                    className="p-1.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-center font-black cursor-pointer uppercase tracking-wider"
                  >
                    Close Dropdown
                  </div>
                </div>
              )}
            </div>

            {/* Inputs list based on unit selection */}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">
                  Part Height / Thickness ({inputUnit})
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rawHeightA}
                    onChange={(e) => handleRawInputChange(setRawHeightA, e.target.value)}
                    className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-sky-500 rounded focus:outline-none font-mono text-slate-100"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                </div>
              </div>

              {mode === 'diameter' && (
                <>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">Outer Rim (OD) ({inputUnit})</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawOdA}
                        onChange={(e) => handleRawInputChange(setRawOdA, e.target.value)}
                        className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-sky-500 rounded focus:outline-none font-mono text-slate-100"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">Inner Core (ID) ({inputUnit})</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawIdA}
                        onChange={(e) => handleRawInputChange(setRawIdA, e.target.value)}
                        className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-sky-500 rounded focus:outline-none font-mono text-slate-100"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#030712]/60 p-2 rounded text-[10px] font-mono text-slate-400 flex items-center justify-between border border-slate-800">
              <span>Metric Standard:</span>
              <span className="text-sky-400 font-bold">
                H: {specs.a.height.toFixed(1)}mm | OD: {specs.a.od.toFixed(1)}mm | ID: {specs.a.id.toFixed(1)}mm
              </span>
            </div>
          </div>

          {/* C. Component B specs */}
          <div className="border-l-4 border-amber-500 bg-amber-950/15 border border-slate-800/80 p-4 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-extrabold text-amber-400 flex items-center gap-1.5">
                🔶 PART B (AMBER GOLD)
              </span>
              <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-900 font-black px-1.5 py-0.5 rounded uppercase">
                B Component
              </span>
            </div>

            {/* Search Dropdown from database */}
            <div className="relative">
              <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Load Part Specs from Inventory
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchB}
                  onChange={(e) => {
                    setSearchB(e.target.value);
                    setShowDropdownB(true);
                  }}
                  onFocus={() => setShowDropdownB(true)}
                  placeholder="Search brand, part number..."
                  className="w-full bg-[#030712] pl-8 pr-8 py-2 text-xs border border-slate-700 rounded focus:outline-none focus:border-amber-500 text-slate-100"
                />
                {searchB && (
                  <button 
                    onClick={() => {
                      setSearchB('');
                      setSelectedProductB(null);
                    }} 
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {showDropdownB && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg shadow-2xl z-20 max-h-48 overflow-y-auto text-xs divide-y divide-slate-800">
                  <div className="p-1.5 text-[8.5px] bg-[#030712] text-slate-450 uppercase font-black tracking-widest text-center">
                    Select Database Filter
                  </div>
                  {filteredProductsB.length === 0 ? (
                    <div className="p-3 text-slate-500 text-center font-semibold">No filters match</div>
                  ) : (
                    filteredProductsB.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct('B', p)}
                        className="p-2.5 hover:bg-amber-950/40 cursor-pointer flex flex-col transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-100 text-[11px]">{p.part_number}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-black">{p.brand}</span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 mt-1 truncate">
                          {p.category || 'General Filter'} {p.height_mm ? `| H: ${p.height_mm}mm` : ''} {p.od_mm ? `| OD: ${p.od_mm}mm` : ''}
                        </div>
                      </div>
                    ))
                  )}
                  <div 
                    onClick={() => setShowDropdownB(false)} 
                    className="p-1.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-center font-black cursor-pointer uppercase tracking-wider"
                  >
                    Close Dropdown
                  </div>
                </div>
              )}
            </div>

            {/* Inputs list based on unit selection */}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">
                  Part Height / Thickness ({inputUnit})
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rawHeightB}
                    onChange={(e) => handleRawInputChange(setRawHeightB, e.target.value)}
                    className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-amber-500 rounded focus:outline-none font-mono text-slate-100"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                </div>
              </div>

              {mode === 'diameter' && (
                <>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">Outer Rim (OD) ({inputUnit})</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawOdB}
                        onChange={(e) => handleRawInputChange(setRawOdB, e.target.value)}
                        className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-amber-500 rounded focus:outline-none font-mono text-slate-100"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-450 uppercase mb-1">Inner Core (ID) ({inputUnit})</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawIdB}
                        onChange={(e) => handleRawInputChange(setRawIdB, e.target.value)}
                        className="w-full bg-[#030712] text-xs p-2 px-3 border border-slate-700 focus:border-amber-500 rounded focus:outline-none font-mono text-slate-100"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500 font-mono uppercase">{inputUnit}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#030712]/60 p-2 rounded text-[10px] font-mono text-slate-400 flex items-center justify-between border border-slate-800">
              <span>Metric Standard:</span>
              <span className="text-amber-400 font-bold">
                H: {specs.b.height.toFixed(1)}mm | OD: {specs.b.od.toFixed(1)}mm | ID: {specs.b.id.toFixed(1)}mm
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg text-[10px] text-slate-400 flex items-start gap-1.5 border border-slate-800">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <p>
              Drag mouse on the 3D grid viewport on the right to rotate orbit perspective. Drag separating sliders to test concentric gap clearances.
            </p>
          </div>
        </section>

        {/* RIGHT VISUALIZATION SANDBOX (FILLS THE REST) */}
        <section className="flex-1 bg-[#030712] flex flex-col relative overflow-hidden">
          
          {/* A. Verdict Banner */}
          <div className="bg-[#0b0f19]/70 border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 z-10 shadow-sm">
            <div className={`p-3 px-4 rounded-xl border flex flex-col space-y-1 w-full md:max-w-xl ${metrics.colorClass}`}>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/40">
                  {metrics.statusBadge}
                </span>
                <span className="font-extrabold text-sm uppercase tracking-wide">
                  {metrics.verdict}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">
                {metrics.desc}
              </p>
            </div>

            {/* Quick alignment metric bubbles */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] shrink-0">
              {mode === 'height' ? (
                <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center shadow-md">
                  <span className="block text-slate-500 text-[8px] uppercase tracking-wider font-black">HEIGHT DELTA</span>
                  <span className="font-black text-slate-200">
                    {fromMm(metrics.dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                  </span>
                </div>
              ) : (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center shadow-md">
                    <span className="block text-slate-500 text-[8px] uppercase tracking-wider font-black">OD DELTA</span>
                    <span className="font-black text-slate-200">
                      {fromMm(metrics.dOd, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center shadow-md">
                    <span className="block text-slate-500 text-[8px] uppercase tracking-wider font-black">ID DELTA</span>
                    <span className="font-black text-slate-200">
                      {fromMm(metrics.dId, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center shadow-md">
                    <span className="block text-slate-500 text-[8px] uppercase tracking-wider font-black">HEIGHT DELTA</span>
                    <span className="font-black text-slate-200">
                      {fromMm(metrics.dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </span>
                  </div>
                </>
              )}

              {/* Reset Orbit Button */}
              <button
                onClick={() => {
                  setAngleX(-0.45);
                  setAngleY(0.75);
                  setAlignmentOffset(30);
                  setZoomLevel(1.0);
                  setPanX(0);
                  setPanY(0);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2.5 rounded-lg border border-slate-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
                title="Reset Camera Angle, Zoom & Panned Position"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* B. MAIN CANVAS RENDER CONTAINER (FULLY FLEXING AVAILABLE SPACE) */}
          <div className="flex-1 relative min-h-[300px]" onWheel={handleWheel}>
            
            {/* Full-Screen Workspace Toggle (Top-Left) */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setIsSidebarHidden(prev => !prev)}
                className="px-3 py-2 bg-[#090d16]/95 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 hover:text-white flex items-center gap-2 shadow-2xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                title={isSidebarHidden ? "Show Settings Panel" : "Maximize 3D Workspace (Hide Settings)"}
              >
                {isSidebarHidden ? (
                  <>
                    <Minimize2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-emerald-400" />
                    <span>Go Full Screen</span>
                  </>
                )}
              </button>

              {/* Interaction Quick Indicator Overlay */}
              <div className="hidden md:flex items-center gap-1.5 bg-[#090d16]/80 border border-slate-800/65 px-3 py-2 rounded-xl text-[9px] font-medium text-slate-400 shadow-md backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  {dragMode === 'rotate' ? '🖱️ Drag to Orbit' : '🖱️ Drag to Move/Pan'} (Hold Shift / Right-click to toggle)
                </span>
              </div>
            </div>

            {/* Floating Workspace Controls & Tools (Top-Right) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-center bg-[#090d16]/95 border border-slate-800 p-2 rounded-xl shadow-2xl space-y-3 backdrop-blur-md">
              {/* INTERACTION DRAG MODE */}
              <div className="flex flex-col gap-1 border-b border-slate-800/80 pb-2 w-full items-center">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest mb-1">DRAG MODE</span>
                <button
                  onClick={() => setDragMode('rotate')}
                  className={`p-2 rounded-lg transition-all cursor-pointer border flex items-center justify-center w-9 h-9 active:scale-95 ${
                    dragMode === 'rotate'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Rotate Model Perspective"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDragMode('pan')}
                  className={`p-2 rounded-lg transition-all cursor-pointer border flex items-center justify-center w-9 h-9 active:scale-95 ${
                    dragMode === 'pan'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Pan/Move Model Position"
                >
                  <Hand className="w-4 h-4" />
                </button>
              </div>

              {/* INTERACTIVE ZOOM CONTROLS */}
              <div className="flex flex-col items-center gap-1 w-full">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">ZOOM</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(8.0, prev + 0.15))}
                  className="p-2 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-800 flex items-center justify-center w-9 h-9 active:scale-95"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="text-[10px] font-mono font-black text-slate-300 w-11 text-center select-none py-0.5">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.15, prev - 0.15))}
                  className="p-2 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-800 flex items-center justify-center w-9 h-9 active:scale-95"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </div>

              {/* RESET VIEW AXIS */}
              <button
                onClick={() => {
                  setZoomLevel(1.0);
                  setPanX(0);
                  setPanY(0);
                  setAngleX(-0.45);
                  setAngleY(0.75);
                }}
                className="w-full py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-md transition-all text-[8px] uppercase font-black tracking-wider border border-slate-800 active:scale-95"
                title="Reset Camera Position"
              >
                Reset
              </button>
            </div>

            {isOverlayMode ? (
              // 1. Overlay Canvas
              <div 
                className="w-full h-full cursor-grab active:cursor-grabbing relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
              >
                <AutoSizingCanvas onDraw={onDrawOverlay} />

                {/* Separation control slider overlayed on canvas bottom area */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/80 p-3 px-6 rounded-2xl shadow-xl flex items-center space-x-4 w-11/12 max-w-md backdrop-blur-md">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider whitespace-nowrap">
                    Spacing Simulator:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alignmentOffset}
                    onChange={(e) => setAlignmentOffset(parseInt(e.target.value, 10))}
                    className="flex-1 accent-emerald-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-emerald-400 font-mono font-bold w-12 text-right">
                    {alignmentOffset}%
                  </span>
                </div>
              </div>
            ) : (
              // 2. Split Screen Canvas (Side by Side)
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800">
                
                {/* Left product canvas */}
                <div 
                  className="w-full h-full cursor-grab active:cursor-grabbing bg-[#090d16] relative"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <AutoSizingCanvas onDraw={onDrawSplitA} />
                </div>

                {/* Right product canvas */}
                <div 
                  className="w-full h-full cursor-grab active:cursor-grabbing bg-[#090d16] relative"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <AutoSizingCanvas onDraw={onDrawSplitB} />
                </div>
              </div>
            )}
          </div>

          {/* C. Spec Comparison Detailed Table */}
          <div className="bg-[#0b0f19] border-t border-slate-800 p-4 shrink-0 z-10">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>📋 ACCURATE COMPILATION SPECIFICATION REPORT</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse font-mono text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-450 text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-3">Specification Attribute</th>
                    <th className="py-2 px-3 text-sky-400">🔷 Product A</th>
                    <th className="py-2 px-3 text-amber-400">🔶 Product B</th>
                    <th className="py-2 px-3 text-rose-400">Mismatch Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">Height / Length</td>
                    <td className="py-2 px-3 font-semibold">
                      {fromMm(specs.a.height, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {fromMm(specs.b.height, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </td>
                    <td className="py-2 px-3 text-rose-400 font-bold">
                      {fromMm(metrics.dHeight, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                    </td>
                  </tr>
                  {mode === 'diameter' && (
                    <>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-300">Outer Diameter (OD)</td>
                        <td className="py-2 px-3 font-semibold">
                          {fromMm(specs.a.od, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {fromMm(specs.b.od, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                        <td className="py-2 px-3 text-rose-400 font-bold">
                          {fromMm(metrics.dOd, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-300">Inner Diameter (ID)</td>
                        <td className="py-2 px-3 font-semibold">
                          {fromMm(specs.a.id, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {fromMm(specs.b.id, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                        <td className="py-2 px-3 text-rose-400 font-bold">
                          {fromMm(metrics.dId, inputUnit).toFixed(inputUnit === 'inch' ? 3 : 1)} {inputUnit}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      </main>

      {/* 3. Footer Bar info panel */}
      <footer className="bg-[#0b0f19] border-t border-slate-800 p-3 px-6 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-2 text-[10px] text-slate-500">
        <div className="flex items-center space-x-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Interactive physical 3D simulations are proportional wireframes based on true aspect ratios of actual filter data.</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-slate-400">Active Inventory Pool: <strong className="text-slate-200">{products.length} Items</strong></span>
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 px-4 py-1.5 rounded font-extrabold uppercase tracking-widest cursor-pointer border border-slate-700/60"
          >
            Exit Workspace
          </button>
        </div>
      </footer>

    </div>
  );
}
