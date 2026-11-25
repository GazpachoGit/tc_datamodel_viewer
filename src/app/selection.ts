import { createContext, useContext } from 'react';
import type { UmlAttribute } from '../model/types';

/** The attribute currently selected in the diagram (UI4). */
export interface SelectedAttribute {
  className: string;
  attribute: UmlAttribute;
}

export interface SelectionState {
  selected: SelectedAttribute | null;
  select: (selection: SelectedAttribute) => void;
}

export const SelectionContext = createContext<SelectionState>({
  selected: null,
  select: () => {},
});

export function useSelection(): SelectionState {
  return useContext(SelectionContext);
}
