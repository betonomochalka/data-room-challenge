import * as React from 'react';

const SlotComponent = ({ children, ...props }: any) => {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return children;
};

export const Slot = SlotComponent;
export const Root = SlotComponent;
export const Slottable = ({ children }: any) => children;
export const createSlot = () => SlotComponent;
export const createSlottable = () => Slottable;

