# Downscale of the full-resolution NASA Black Marble map to a size that Cycles can hold
import bpy, os
HERE = os.path.dirname(os.path.abspath(__file__))
img = bpy.data.images.load(os.path.join(HERE, 'textures_dl', 'night_full.jpg'))
print('SRC', img.size[:])
img.scale(16384, 8192)
img.filepath_raw = os.path.join(HERE, 'textures_dl', 'night_hi.jpg'); img.file_format = 'JPEG'
img.save(quality=92)
print('NIGHT_HI saved')
