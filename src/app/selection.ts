import { createContext, useContext } from 'react';
import type { GrmRule, UmlAttribute, UmlCompound } from '../model/types';

/**
 * The attribute, compound property, or relation class currently selected in
 * the diagram (UI4).
 */
export type SelectedProperty =
  | { className: string; kind: 'attribute'; attribute: UmlAttribute }
  | { className: string; kind: 'compound'; compound: UmlCompound }
  | { className: string; kind: 'relationClass'; grmRules: GrmRule[] };

export interface SelectionState {
  selected: SelectedProperty | null;
  select: (selection: SelectedProperty) => void;
}

export const SelectionContext = createContext<SelectionState>({
  selected: null,
  select: () => {},
});

export function useSelection(): SelectionState {
  return useContext(SelectionContext);
}

/** Name of the selected property; null for a whole-class selection. */
export function selectedName(selected: SelectedProperty): string | null {
  switch (selected.kind) {
    case 'attribute':
      return selected.attribute.name;
    case 'compound':
      return selected.compound.name;
    case 'relationClass':
      return null;
  }
}
