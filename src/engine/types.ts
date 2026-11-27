// The types of the station boundary: the Station, its records, the host callbacks and the raw room and pick objects.
import type * as THREE from 'three';

export type RoomId = string;
export type PickId = string;
export type PickKind = 'door' | 'terminal' | 'exhibit' | 'station' | 'contact' | 'thing';
export type ViewName = 'wide' | 'close';
export type ReaderState = 'closed' | 'scanning' | 'open';

export interface Readable<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomStatus {
  id: RoomId | null;
  status: 'loading' | 'ready' | 'failed';
  progress: number;
  label: string;
  error?: string;
}

export interface Way {
  label: string;
  to: RoomId | '';
}

export interface Option {
  label: string;
  sub?: string;
}

export interface Focused {
  pick: PickId;
  name: string;
  verb: string;
  aside: boolean;
  steady: boolean;
  backLabel: string;
  tour: { index: number; count: number };
  ways: Way[];
  options: Option[] | null;
  current: number;
  list: boolean;
  canRead: boolean;
  readLabel: string;
  typing: boolean;
  reads: boolean;
  url: string | null;
  title: string | null;
}

export interface Cue {
  pointer: string;
  touch: string;
  [kind: string]: string;
}

export interface StationPick {
  id: PickId;
  name: string;
  verb: string;
  kind: PickKind;
  cta?: boolean;
  canRead?: boolean;
  cue?: Cue;
}

export interface ReaderInfo {
  state: ReaderState;
  url: string | null;
  title: string | null;
  phone: boolean;
}

export interface ReaderFrame {
  width: number;
  height: number;
  transform: string;
  reveal: number;
}

export interface ContactLink {
  label: string;
  note: string;
  url: string;
}

export interface ContactInfo {
  open: boolean;
  links: ContactLink[];
}

export interface PointerHow {
  scene?: boolean;
  steer?: boolean;
  at?: number;
}

export interface TurnFeel {
  SLOPE: number;
  WHEEL: number;
  LINE: number;
  VERTICAL: boolean;
  IDLE: number;
  LEAN: number;
  STEP: number;
  FLING: number;
}

export interface TurnApi {
  angle(): number;
  grab(): number;
  drag(angle: number): void;
  release(velocity?: number, lean?: number): void;
  step(direction: number): void;
  moving(): boolean;
  usable(): boolean;
  grip(): number;
  feel: TurnFeel;
}

export interface StationHost {
  onLink(href: string | null): boolean | void;
  onShown?(): void;
  travel?(to: RoomId): void;
  clearance?(x0: number, x1: number): number;
}

export interface Pose {
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
}

export interface Door {
  label: string;
  to?: RoomId;
  stops?: [string, RoomId | ''][];
}

export interface Source {
  url: string;
  how?: string;
  [key: string]: unknown;
}

export interface Pick {
  mesh: THREE.Mesh;
  pose(): Pose;
  name?: string;
  verb?: string;
  cue?: Cue;
  door?: Door;
  options?: [string, () => void, string?][];
  current?(): number;
  list?: boolean;
  enter?(): Pick | null;
  enterLabel?: string;
  onFocus?(on: boolean, next?: Pick | null): void;
  source?(): Source | null;
  returnLabel?: string;
  back?(): Pick | null;
  backLabel?: string;
  url?(): string | null;
  title?(): string | null;
  reads?: boolean;
  aside?: boolean;
  steady?: boolean;
  live?(): boolean;
  calm?(): boolean;
  typing?(): boolean;
  click?(uv: THREE.Vector2): void;
  cursor?(uv: THREE.Vector2): string;
  cta?: boolean;
  station?: number;
  bounds?(): THREE.Vector3[];
  left?(): void;
}

export interface RoomInfo {
  fov?: number;
  floor: { rough: [number, number] };
  exposure?: number;
  [key: string]: unknown;
}

export interface RoomText {
  path: string;
  title: string;
  nav: string;
  kicker: string;
  headline: string[];
  sub: string[];
  facts: [string, string][];
  close: string;
  loading: string;
  place?: string;
  cta?: string;
  ctaReads?: string;
  credit?: boolean;
  bright?: boolean;
  hint?: { until?: string; pointer?: string; touch?: string };
  [key: string]: unknown;
}

export interface Content {
  brand: string;
  credit: string;
  rooms: Record<RoomId, RoomText>;
  reader: Record<string, string>;
  display: Record<string, unknown> & { hint: Record<string, string> };
  [key: string]: unknown;
}

export interface SitePage {
  url: string;
  title: string;
  [key: string]: unknown;
}

export interface SiteData {
  posts: SitePage[];
  projects: SitePage[];
  profile: Record<string, unknown> | null;
}

export interface Volume {
  slug: string;
  title: string;
  url: string;
}

export interface RawTurn {
  angle(): number;
  front(): number;
  settled(): boolean;
  moving(): boolean;
  byHand(): boolean;
  heading(): number | null;
  grab(): number;
  drag(angle: number): void;
  release(velocity?: number, lean?: number): void;
  to(i: number, now?: boolean): void;
  step(direction: number): void;
  nudge(r: number): void;
  grip(camera: THREE.PerspectiveCamera, height: number): number;
}

export interface RawReader {
  state(): ReaderState;
  url(): string | null;
  title(): string | null;
  offeredBy(): Pick | null;
  jump(id: string): void;
  scrollTo(id: string): void;
  frame(): ReaderFrame | null;
}

export interface RawContact {
  expanded(): boolean;
  links(): ContactLink[];
  linkRect(index: number): [number, number, number, number] | null;
}

export interface Room {
  id: RoomId;
  info: RoomInfo;
  scene: THREE.Scene;
  picks: Pick[];
  floors: THREE.Object3D[];
  hidden: THREE.Object3D[];
  CAM: THREE.Vector3;
  TGT: THREE.Vector3;
  CLOSE: THREE.Vector3;
  CLOSE_TGT: THREE.Vector3;
  arc: number;
  exposure: number;
  chart: { draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void; dispose(): void } | null;
  reader: RawReader | null;
  comms: RawContact | null;
  terminal: Pick | null;
  volumes: Volume[];
  turn: RawTurn | null;
  reads(url: string | null | undefined): boolean;
  heldVolume(): number;
  read(url: string, fly: boolean): Promise<Pick | null>;
  prepass: ((renderer: THREE.WebGLRenderer) => void) | null;
  capture: ((renderer: THREE.WebGLRenderer) => void) | null;
  update(t: number): void;
  dispose(): void;
}

export interface Mode {
  room: RoomId | undefined;
  hdr: boolean;
  tier: number;
  msaa: number;
  scale: number;
  size: string;
  mirror: string;
}

export interface StationDebug {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  post: unknown;
  gov: unknown;
  series: number[];
  readonly room: Room | null;
  readonly turn: (RawTurn & { grip(): number }) | null;
  setFocus(pick?: Pick | null): void;
  ready(): number;
  volumes(): { slug: string; title: string }[];
  held(): string | null;
  mode(): Mode;
  lightFrame?(eye: [number, number, number], at: [number, number, number], t: number): void;
  modules?: Record<string, unknown>;
}

export interface Station {
  start(): void;
  dispose(): void;

  enter(id: RoomId, options?: { want?: string }): Promise<void>;
  room: Readable<RoomStatus>;
  reads(url: string | null | undefined): boolean;
  readonly volumesCount: number;

  focus(pick: PickId | null): void;
  back(): void;
  step(direction: 1 | -1): void;
  focused: Readable<Focused | null>;
  choose(option: number): void;
  travel(to: RoomId): void;
  read(pick?: PickId): boolean;

  picks: Readable<StationPick[]>;
  pointed: Readable<PickId | null>;
  rectOf(pick: PickId): Rect | null;
  gliding: Readable<boolean>;
  wideAtRest: Readable<boolean>;
  hintTurnDone: Readable<boolean>;

  reader: Readable<ReaderInfo>;
  readAt(url: string, options?: { fly?: boolean }): Promise<boolean>;
  closeReader(): void;
  jump(anchor: string): void;
  readerScrollTo(anchor: string): void;
  frameOf(what: 'reader'): ReaderFrame | null;

  contact: Readable<ContactInfo>;
  contactLinkRect(index: number): Rect | null;

  setCovered(region: 'bar', rect: Rect | null): void;

  view: Readable<ViewName>;
  setView(view: ViewName, options?: { now?: boolean }): void;
  readonly turn: TurnApi | null;
  onFrame(callback: (seconds: number) => void): () => void;

  pointer(x: number, y: number, type: string, how?: PointerHow): void;
  pointerGone(): void;
  tilt(gamma: number, beta: number): void;
  tap(x: number, y: number): void;
  setActive(on: boolean): void;
  resize(width: number, height: number, dpr: number): void;
  setHidden(hidden: boolean): void;

  debug: StationDebug;
}
