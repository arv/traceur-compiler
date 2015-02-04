// Options: --sane-script
// Error: :7:3: == is not allowed in sane mode
// Error: :8:3: != is not allowed in sane mode

'use sanity'

1 == 2;
3 != 4;
