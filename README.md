# ImageRot Video Wrapper

A very simple video wrapper for [ImageRot](https://github.com/sixem/imagerot).

## Example Usage
```js
import { render } from 'imagerot-video-wrapper';

render({
    videoPath: './input.mp4',
    videoOut: './output.mp4',
    action: async ({ staged, useEffect, useMode, current }) => {
        return await useEffect(staged, 'hueShift', { shift: (current * 2) % 360 });
    }
});
```

### Result:
https://github.com/seedr/imagerot-video-wrapper/assets/2825338/7d905cf8-34ac-4ac1-9e3b-290865d3ae53
