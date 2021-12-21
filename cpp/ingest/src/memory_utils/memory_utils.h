
#ifndef DATADOCS_INGEST_MEMORY_UTILS_H
#define DATADOCS_INGEST_MEMORY_UTILS_H

unsigned int getTotalMemory();

unsigned int getFreeMemory();

unsigned int getPeakMemory();

void printMemoryReport();

void ensureMemory( unsigned int MB );

#endif
