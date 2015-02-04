// Options: --sane-script
// Error: :8:3: == is not allowed in sane mode
// Error: :9:3: != is not allowed in sane mode

'use sanity'
'use strict'

1 == 2;
3 != 4;
