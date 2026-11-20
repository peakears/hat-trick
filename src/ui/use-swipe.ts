import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";
import { isHorizontalDrag, swipeDayStep } from "./swipe";

/** Pan handlers for a view: a sideways swipe calls `onStep(+1)` (left) or `onStep(-1)` (right). */
export function useDaySwipe(onStep: (step: 1 | -1) => void) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  return useMemo(
    () =>
      PanResponder.create({
        // Only sideways drags are taken over; vertical ones stay with the list's own scrolling.
        onMoveShouldSetPanResponder: (_e, g) => isHorizontalDrag(g.dx, g.dy),
        onPanResponderRelease: (_e, g) => {
          const step = swipeDayStep(g.dx, g.dy);
          if (step !== 0) onStepRef.current(step);
        },
      }),
    [],
  );
}
