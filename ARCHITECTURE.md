# Architecture & Design

## Logic Flow
1. **User Action**: User draws (MouseDown -> Move -> Up).
2. **Local Render**: "Current" path is rendered locally for low latency.
3. **Event Emission**: `draw_step` sends segments as they are drawn. `draw_op` sends the final operation.
4. **Server Processing**: Server adds `draw_op` to Room History and broadcasts `new_op`.
5. **Remote Render**: Clients receive `new_op`, add to history, and redraw.

## Global Undo / Redo
The app implements a Global History Stack for each room.
1. **Undo**: Popping the last operation from global history.
2. **Redo**: Restoring the last action from the shared undone stack.
