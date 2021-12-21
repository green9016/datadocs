//
// Created by gab on 07/01/19.
//

#include <simple_icu_init.h>

int main() {
  // The ICU data file is located in '/icu/' path (NB: 'MemFS' filesystem)
  return simple_icu_init( "/icu/" );
};
