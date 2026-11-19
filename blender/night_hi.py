"""Downscale NASA's full-resolution Black Marble (21600x10800) to a size Cycles can hold comfortably.
   blender -b --python night_hi.py      (expects textures_dl/night_full.jpg, writes textures_dl/night_hi.jpg)"""
import bpy, os
HERE = os.path.dirname(os.path.abspath(__file__))
img = bpy.data.images.load(os.path.join(HERE, 'textures_dl', 'night_full.jpg'))
print('SRC', img.size[:])
img.scale(16384, 8192)
img.filepath_raw = os.path.join(HERE, 'textures_dl', 'night_hi.jpg'); img.file_format = 'JPEG'
img.save(quality=92)
print('NIGHT_HI saved')
