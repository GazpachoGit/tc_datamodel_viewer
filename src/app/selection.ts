import { createContext, useContext } from 'react';
import type { UmlAttribute, UmlCompound } from '../model/types';

/** The attribute or compound property currently selected in the diagram (UI4). */
export type SelectedProperty =
  | { className: string; kind: 'attribute'; attribute: UmlAttribute }
  | { className: string; kind: 'compound'; compound: UmlCompound };

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

/** Name of the selected property, regardless of its kind. */
export function selectedName(selected: SelectedProperty): string {
  return selected.kind === 'attribute' ? selected.attribute.name : selected.compound.name;
}
