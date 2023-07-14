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
https://github.com/seedr/imagerot-video-wrapper/assets/2825338/7668239d-07c2-4efa-9400-d3aafcab10c9
