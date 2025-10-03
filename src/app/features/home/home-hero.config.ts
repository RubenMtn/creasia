export type LinkAnchor = 'top' | 'right' | 'bottom' | 'left';
export type AnimationPhase = 'points' | 'connectors';

export interface LinkItem {
  key: string;
  route: string;
  cls: string;
  pointId: FacePoint['id'];
  anchor: LinkAnchor;
}

export interface FacePoint {
  id: string;
  x: number;
  y: number;
}

export const HERO_FRAME_ASPECT = {
  cssAspectRatio: '16 / 9',
  numericFrameRatio: 16 / 9,
  referenceImageRatio: 1600 / 593
} as const;

export const HERO_TIMING = {
  POINTS_DELAY: 120,
  LINES_LEAD: 180,
  LINES_DRAW_DURATION: 140,
  LINKS_DURATION: 900,
  LINKS_BUFFER: 160,
  BASE_DELAY: 200,
  STAGGER: 180
} as const;

export const HERO_FACE_POINTS: FacePoint[] = [
  { id: 'eye-left', x: 34.5, y: 31.2 },
  { id: 'eye-right', x: 67, y: 31.2 },
  { id: 'mouth-left', x: 42, y: 85 },
  { id: 'mouth-right', x: 56.4, y: 90 }
];

export const HERO_LINKS: LinkItem[] = [
  { key: 'menu.activities', route: '/actividades', cls: 'l-top-left', pointId: 'eye-left', anchor: 'bottom' },
  { key: 'menu.gourmet', route: '/gourmet', cls: 'l-top-right', pointId: 'eye-right', anchor: 'bottom' },
  { key: 'menu.partners', route: '/socios', cls: 'l-bot-left', pointId: 'mouth-left', anchor: 'right' },
  { key: 'menu.trips', route: '/viajes', cls: 'l-bot-right', pointId: 'mouth-right', anchor: 'left' }
];

export const HERO_SLIDES = [
  { src: 'assets/pics/slide1.jpg', alt: 'Proyecto A', caption: '' },
  { src: 'assets/pics/slide2.jpg', alt: 'Proyecto B', caption: '' },
  { src: 'assets/pics/slide3.jpg', alt: 'Proyecto C', caption: '' },
  { src: 'assets/pics/slide4.jpg', alt: 'Proyecto D', caption: '' },
  { src: 'assets/pics/slide5.jpg', alt: 'Proyecto E', caption: '' },
  { src: 'assets/pics/slide6.jpg', alt: 'Proyecto F', caption: '' },
  { src: 'assets/pics/slide7.jpg', alt: 'Proyecto G', caption: '' }
] as const;
