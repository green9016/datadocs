import glob
from distutils.core import setup
from distutils.extension import Extension
from Cython.Build import cythonize

ext = Extension('inferrer_c', sources = ['inferrer_c.pyx'] + glob.glob('../**/*.cpp', recursive=True) + glob.glob('../**/*.c', recursive=True),
	include_dirs = ['..'],
        libraries = ['icuin', 'icudata', 'icui18n', 'icuio', 'icutu', 'icuuc'],
        library_dirs = [''],
        extra_compile_args=['-std=c++17'])

setup(
        name = 'inferrer_c',
        ext_modules = cythonize(ext, compiler_directives = {'language_level': 3}, annotate=True),
        script_args = ['build_ext', '--inplace'],
)

