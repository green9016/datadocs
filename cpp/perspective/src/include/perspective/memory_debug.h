// GAB: Utility methods to debug memory (only implemented on Emscripten)
#pragma once

#if defined(ENABLE_MEMORY_DEBUG)
#define MEM_REPORT(x) printMemoryReport(x)
#else
#define MEM_REPORT(x)
#endif

unsigned int getTotalMemory();
unsigned int getPeakMemory();
unsigned int getFreeMemory();
void printMemoryReport(const char* str);
