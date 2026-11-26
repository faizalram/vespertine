import { FIELD_H, FIELD_W } from '../game/constants';
import type { Rect } from '../render/renderer';

export interface Layout {
  mode: 'desktop' | 'portrait';
  vw: number;
  vh: number;
  field: Rect;
  /** CSS pixels per field unit. */
  scale: number;
  /** Side panel (desktop) or top strip (portrait). */
  panel: Rect;
  /** Portrait only: area under the field for meters and thumb controls. */
  controls: Rect;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ASPECT = FIELD_W / FIELD_H; // 6:7

export function readSafeInsets(probe: HTMLElement): Insets {
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

/**
 * Portrait phones: the field spans the full width and the space underneath
 * becomes the thumb zone, so fingers never cover bullets (spec §8.2).
 * Everything else: field centred with the HUD in a side panel.
 */
export function computeLayout(vw: number, vh: number, ins: Insets): Layout {
  const portrait = vh / vw > 1.3;
  if (portrait) {
    const strip = 38;
    const minControls = 150;
    const top = ins.top + strip;
    const availW = vw - ins.left - ins.right;
    let w = availW;
    let h = w / ASPECT;
    const maxH = vh - top - ins.bottom - minControls;
    if (h > maxH) {
      h = maxH;
      w = h * ASPECT;
    }
    const x = ins.left + (availW - w) / 2;
    const field = { x: Math.round(x), y: Math.round(top), w: Math.round(w), h: Math.round(h) };
    return {
      mode: 'portrait',
      vw,
      vh,
      field,
      scale: field.w / FIELD_W,
      panel: { x: ins.left, y: ins.top, w: availW, h: strip },
      controls: { x: ins.left, y: field.y + field.h, w: availW, h: vh - ins.bottom - (field.y + field.h) },
    };
  }
  const pad = 12;
  const gap = 16;
  const availH = vh - ins.top - ins.bottom - pad * 2;
  const availW = vw - ins.left - ins.right - pad * 2;
  let panelW = Math.min(260, Math.max(170, availW * 0.25));
  let h = availH;
  let w = h * ASPECT;
  if (w + gap + panelW > availW) {
    w = Math.max(availW - gap - panelW, availW * 0.6);
    h = w / ASPECT;
    panelW = Math.max(0, availW - w - gap);
  }
  const total = w + gap + panelW;
  const x = ins.left + pad + (availW - total) / 2;
  const y = ins.top + pad + (availH - h) / 2;
  const field = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  return {
    mode: 'desktop',
    vw,
    vh,
    field,
    scale: field.w / FIELD_W,
    panel: { x: field.x + field.w + gap, y: field.y, w: panelW, h: field.h },
    controls: { x: 0, y: 0, w: 0, h: 0 },
  };
}
