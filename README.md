# ImageRot Video Wrapper

A very simple video wrapper for [ImageRot](https://github.com/sixem/imagerot).

## Example Usage
```js
import { render } from 'imagerot-video-wrapper';

render({
    videoPath: './input.mp4',
    videoOut: './output.mp4',
    action: async ({ staged, useEffect, useMode, current }) => {
        staged = await useEffect(staged, 'hueShift', { shift: (current * 2) % 360 });
        return staged;
    }
});
```

### Result
https://github.com/seedr/imagerot-video-wrapper/assets/2825338/f54388bb-d82e-4b7d-9199-1cac97c89121
