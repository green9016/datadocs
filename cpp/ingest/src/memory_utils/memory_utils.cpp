#include "memory_utils.h"

// STD
#include <cstdio>

// POSIX
#include "malloc.h"

// Emscripten
#if defined( __EMSCRIPTEN__ )
#include <emscripten.h>
#include <emscripten/bind.h>
#endif

unsigned int getTotalMemory() {
#if defined( __EMSCRIPTEN__ )
  return EM_ASM_INT( return HEAP8.length );
#else
  // on windows or other: TODO
  return 0;
#endif
}

unsigned int getPeakMemory() {
#if defined( __EMSCRIPTEN__ )
  struct mallinfo i = mallinfo();
  return i.usmblks + 5 * 1024 * 1024;  // Add the Stack size (part of full memory)
#else
  // on windows or other: TODO
  return 0;
#endif
}

unsigned int getFreeMemory() {
#if defined( __EMSCRIPTEN__ )
  struct mallinfo i = mallinfo();
  unsigned int totalMemory = getTotalMemory();
  unsigned int dynamicTop = EM_ASM_INT( return HEAPU32[DYNAMICTOP_PTR >> 2] );
  return totalMemory - dynamicTop + i.fordblks;
#else
  // on windows or other: TODO
  return 0;
#endif
}

void printMemoryReport() {
#if defined( __EMSCRIPTEN__ )
  printf( "Total memory: %u B (%.2f MB)\n", getTotalMemory(), (double)getTotalMemory() / (double)( 1024 * 1024 ) );
  printf( "Free memory: %u B (%f MB)\n", getFreeMemory(), (double)getFreeMemory() / (double)( 1024 * 1024 ) );
  printf( "Peak memory: %u bytes (%.2f MB)\n", getPeakMemory(), (double)getPeakMemory() / (double)( 1024 * 1024 ) );
  printf( "Used: %u bytes (%.2f MB) (%.2f%%)\n", getTotalMemory() - getFreeMemory(),
          (double)( getTotalMemory() - getFreeMemory() ) / (double)( 1024 * 1024 ),
          ( getTotalMemory() - getFreeMemory() ) * 100.0 / getTotalMemory() );
#endif
}

// Only needed on Emscripten, to force memory growth if needed before some operations that needs to keep the pointers
// stable (eg. emscripten::memory_views)
void ensureMemory( unsigned int MB ) {
#if defined( __EMSCRIPTEN__ )
  if ( getFreeMemory() < MB * 1024 * 1024 ) {
    void* p = malloc( MB * 1024 * 1024 );
    free( p );
  }
#endif
}
