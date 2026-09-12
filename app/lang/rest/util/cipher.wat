(module
  (memory (export "memory") 1)

  ;; Round constants table
  (data (i32.const 0x0090) "\00\01\02\04\08\10\20\40\80\1b\36\6c\d8\ab\4d\9a")

  ;; Mixed Boolean-Arithmetic (MBA) multiplication from customAes.js
  (func $gf_mul (param $a i32) (param $b i32) (result i32)
    (local $p i32)
    (local $ca i32)
    (local $cb i32)
    (local $i i32)
    (local $h i32)
    (local $term1 i32)
    (local $term2 i32)
    (local.set $p (i32.const 0))
    (local.set $ca (i32.and (local.get $a) (i32.const 255)))
    (local.set $cb (i32.and (local.get $b) (i32.const 255)))
    (local.set $i (i32.const 0))
    (block $b0
      (loop $l0
        (br_if $b0 (i32.ge_u (local.get $i) (i32.const 8)))
        (if (i32.and (local.get $cb) (i32.const 1))
          (then
            ;; term1 = (p ^ ca) + ((p & ca) << 1)
            (local.set $term1
              (i32.add
                (i32.xor (local.get $p) (local.get $ca))
                (i32.shl (i32.and (local.get $p) (local.get $ca)) (i32.const 1))
              )
            )
            ;; term2 = term1 - (p | ca)
            (local.set $term2 (i32.sub (local.get $term1) (i32.or (local.get $p) (local.get $ca))))
            ;; p = term2 ^ (p ^ ca)
            (local.set $p (i32.xor (local.get $term2) (i32.xor (local.get $p) (local.get $ca))))
          )
        )
        (local.set $h (i32.and (local.get $ca) (i32.const 0x80)))
        (local.set $ca (i32.and (i32.shl (local.get $ca) (i32.const 1)) (i32.const 255)))
        (if (local.get $h)
          (then
            (local.set $ca (i32.xor (local.get $ca) (i32.const 0x1b)))
          )
        )
        (local.set $cb (i32.shr_u (local.get $cb) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l0)
      )
    )
    (i32.and (local.get $p) (i32.const 255))
  )

  ;; Derives dynamic S-box and inverse S-box
  (func $derive_sbox
    (local $i i32)
    (local $acc i32)
    (local $j i32)
    (local $tmp i32)
    (local $sw i32)

    ;; Initialize sbox identity: sbox[i] = i
    (local.set $i (i32.const 0))
    (loop $init_loop
      (i32.store8 (i32.add (i32.const 0x0100) (local.get $i)) (local.get $i))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $init_loop (i32.lt_u (local.get $i) (i32.const 256)))
    )

    ;; Fisher-Yates shuffle
    (local.set $acc (i32.const 0))
    (local.set $i (i32.const 255))
    (loop $shuffle_loop
      ;; acc = (acc + sbox[i] + ent[i % 64] + key[i % 32]) & 0xff
      (local.set $acc
        (i32.and
          (i32.add
            (i32.add
              (local.get $acc)
              (i32.load8_u (i32.add (i32.const 0x0100) (local.get $i)))
            )
            (i32.add
              (i32.load8_u (i32.add (i32.const 0x0020) (i32.rem_u (local.get $i) (i32.const 64))))
              (i32.load8_u (i32.add (i32.const 0x0000) (i32.rem_u (local.get $i) (i32.const 32))))
            )
          )
          (i32.const 255)
        )
      )
      ;; j = acc % (i + 1)
      (local.set $j (i32.rem_u (local.get $acc) (i32.add (local.get $i) (i32.const 1))))
      ;; swap sbox[i], sbox[j]
      (local.set $tmp (i32.load8_u (i32.add (i32.const 0x0100) (local.get $i))))
      (i32.store8
        (i32.add (i32.const 0x0100) (local.get $i))
        (i32.load8_u (i32.add (i32.const 0x0100) (local.get $j)))
      )
      (i32.store8 (i32.add (i32.const 0x0100) (local.get $j)) (local.get $tmp))

      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br_if $shuffle_loop (i32.gt_u (local.get $i) (i32.const 0)))
    )

    ;; Derangement fixup: if sbox[i] == i, swap with sbox[(i+1)&0xff]
    (local.set $i (i32.const 0))
    (loop $fix_loop
      (if (i32.eq (i32.load8_u (i32.add (i32.const 0x0100) (local.get $i))) (local.get $i))
        (then
          (local.set $sw (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 255)))
          (local.set $tmp (i32.load8_u (i32.add (i32.const 0x0100) (local.get $i))))
          (i32.store8
            (i32.add (i32.const 0x0100) (local.get $i))
            (i32.load8_u (i32.add (i32.const 0x0100) (local.get $sw)))
          )
          (i32.store8 (i32.add (i32.const 0x0100) (local.get $sw)) (local.get $tmp))
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $fix_loop (i32.lt_u (local.get $i) (i32.const 256)))
    )

    ;; Derive inverse sbox: invSbox[sbox[i]] = i
    (local.set $i (i32.const 0))
    (loop $inv_loop
      (i32.store8
        (i32.add (i32.const 0x0200) (i32.load8_u (i32.add (i32.const 0x0100) (local.get $i))))
        (local.get $i)
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $inv_loop (i32.lt_u (local.get $i) (i32.const 256)))
    )
  )

  ;; Key expansion: generates 60 32-bit round words at 0x0300
  (func $expand_key
    (local $i i32)
    (local $t i32)
    (local $b0 i32)
    (local $b1 i32)
    (local $b2 i32)
    (local $b3 i32)
    (local $rc i32)

    ;; First 8 words from key (big-endian 32-bit words)
    (local.set $i (i32.const 0))
    (loop $k_init
      (local.set $b0 (i32.load8_u (i32.add (i32.const 0x0000) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $b1 (i32.load8_u (i32.add (i32.const 0x0001) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $b2 (i32.load8_u (i32.add (i32.const 0x0002) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $b3 (i32.load8_u (i32.add (i32.const 0x0003) (i32.mul (local.get $i) (i32.const 4)))))
      (i32.store
        (i32.add (i32.const 0x0300) (i32.mul (local.get $i) (i32.const 4)))
        (i32.or
          (i32.or
            (i32.shl (local.get $b0) (i32.const 24))
            (i32.shl (local.get $b1) (i32.const 16))
          )
          (i32.or
            (i32.shl (local.get $b2) (i32.const 8))
            (local.get $b3)
          )
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $k_init (i32.lt_u (local.get $i) (i32.const 8)))
    )

    ;; Words 8 to 59
    (local.set $i (i32.const 8))
    (loop $k_exp
      (local.set $t (i32.load (i32.add (i32.const 0x0300) (i32.mul (i32.sub (local.get $i) (i32.const 1)) (i32.const 4)))))
      (if (i32.eq (i32.rem_u (local.get $i) (i32.const 8)) (i32.const 0))
        (then
          ;; RotWord: (t << 8) | (t >>> 24)
          (local.set $t (i32.rotl (local.get $t) (i32.const 8)))
          ;; SubWord via S-box
          (local.set $b0 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 24)) (i32.const 255)))))
          (local.set $b1 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 16)) (i32.const 255)))))
          (local.set $b2 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 8)) (i32.const 255)))))
          (local.set $b3 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (local.get $t) (i32.const 255)))))
          (local.set $t
            (i32.or
              (i32.or (i32.shl (local.get $b0) (i32.const 24)) (i32.shl (local.get $b1) (i32.const 16)))
              (i32.or (i32.shl (local.get $b2) (i32.const 8)) (local.get $b3))
            )
          )
          ;; XOR with RC[i / 8] << 24
          (local.set $rc (i32.load8_u (i32.add (i32.const 0x0090) (i32.div_u (local.get $i) (i32.const 8)))))
          (local.set $t (i32.xor (local.get $t) (i32.shl (local.get $rc) (i32.const 24))))
        )
        (else
          (if (i32.eq (i32.rem_u (local.get $i) (i32.const 8)) (i32.const 4))
            (then
              ;; SubWord
              (local.set $b0 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 24)) (i32.const 255)))))
              (local.set $b1 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 16)) (i32.const 255)))))
              (local.set $b2 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (i32.shr_u (local.get $t) (i32.const 8)) (i32.const 255)))))
              (local.set $b3 (i32.load8_u (i32.add (i32.const 0x0100) (i32.and (local.get $t) (i32.const 255)))))
              (local.set $t
                (i32.or
                  (i32.or (i32.shl (local.get $b0) (i32.const 24)) (i32.shl (local.get $b1) (i32.const 16)))
                  (i32.or (i32.shl (local.get $b2) (i32.const 8)) (local.get $b3))
                )
              )
            )
          )
        )
      )
      ;; w[i] = w[i - 8] ^ t
      (i32.store
        (i32.add (i32.const 0x0300) (i32.mul (local.get $i) (i32.const 4)))
        (i32.xor
          (i32.load (i32.add (i32.const 0x0300) (i32.mul (i32.sub (local.get $i) (i32.const 8)) (i32.const 4))))
          (local.get $t)
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $k_exp (i32.lt_u (local.get $i) (i32.const 60)))
    )
  )

  ;; Encrypt single 16-byte counter block at 0x0060 into keystream at 0x0080
  (func $cipher_block
    (local $c i32)
    (local $i i32)
    (local $val i32)
    (local $round i32)
    (local $a1 i32) (local $a2 i32) (local $a3 i32) (local $a6 i32)
    (local $s0 i32) (local $s1 i32) (local $s2 i32) (local $s3 i32)
    (local $off i32)

    ;; Copy counter (0x0060) to round state (0x0070)
    (local.set $i (i32.const 0))
    (loop $cp_loop
      (i32.store8
        (i32.add (i32.const 0x0070) (local.get $i))
        (i32.load8_u (i32.add (i32.const 0x0060) (local.get $i)))
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cp_loop (i32.lt_u (local.get $i) (i32.const 16)))
    )

    ;; Initial whitening (Round 0)
    (local.set $c (i32.const 0))
    (loop $w_loop
      (local.set $val (i32.load (i32.add (i32.const 0x0300) (i32.mul (local.get $c) (i32.const 4)))))
      (i32.store8 (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4)))
        (i32.xor (i32.load8_u (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4)))) (i32.and (i32.shr_u (local.get $val) (i32.const 24)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))) (i32.and (i32.shr_u (local.get $val) (i32.const 16)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))) (i32.and (i32.shr_u (local.get $val) (i32.const 8)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))) (i32.and (local.get $val) (i32.const 255))))
      (local.set $c (i32.add (local.get $c) (i32.const 1)))
      (br_if $w_loop (i32.lt_u (local.get $c) (i32.const 4)))
    )

    ;; Rounds 1 to 13
    (local.set $round (i32.const 1))
    (loop $r_loop
      ;; SubBytes
      (local.set $i (i32.const 0))
      (loop $sub_loop
        (i32.store8
          (i32.add (i32.const 0x0070) (local.get $i))
          (i32.load8_u (i32.add (i32.const 0x0100) (i32.load8_u (i32.add (i32.const 0x0070) (local.get $i)))))
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $sub_loop (i32.lt_u (local.get $i) (i32.const 16)))
      )

      ;; ShiftRows
      (local.set $a1 (i32.load8_u (i32.const 0x0071)))
      (i32.store8 (i32.const 0x0071) (i32.load8_u (i32.const 0x0075)))
      (i32.store8 (i32.const 0x0075) (i32.load8_u (i32.const 0x0079)))
      (i32.store8 (i32.const 0x0079) (i32.load8_u (i32.const 0x007d)))
      (i32.store8 (i32.const 0x007d) (local.get $a1))

      (local.set $a2 (i32.load8_u (i32.const 0x0072)))
      (local.set $a6 (i32.load8_u (i32.const 0x0076)))
      (i32.store8 (i32.const 0x0072) (i32.load8_u (i32.const 0x007a)))
      (i32.store8 (i32.const 0x0076) (i32.load8_u (i32.const 0x007e)))
      (i32.store8 (i32.const 0x007a) (local.get $a2))
      (i32.store8 (i32.const 0x007e) (local.get $a6))

      (local.set $a3 (i32.load8_u (i32.const 0x007f)))
      (i32.store8 (i32.const 0x007f) (i32.load8_u (i32.const 0x007b)))
      (i32.store8 (i32.const 0x007b) (i32.load8_u (i32.const 0x0077)))
      (i32.store8 (i32.const 0x0077) (i32.load8_u (i32.const 0x0073)))
      (i32.store8 (i32.const 0x0073) (local.get $a3))

      ;; MixColumns
      (local.set $c (i32.const 0))
      (loop $mix_loop
        (local.set $i (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))))
        (local.set $s0 (i32.load8_u (local.get $i)))
        (local.set $s1 (i32.load8_u (i32.add (local.get $i) (i32.const 1))))
        (local.set $s2 (i32.load8_u (i32.add (local.get $i) (i32.const 2))))
        (local.set $s3 (i32.load8_u (i32.add (local.get $i) (i32.const 3))))

        (i32.store8 (local.get $i)
          (i32.xor (i32.xor (call $gf_mul (local.get $s0) (i32.const 2)) (call $gf_mul (local.get $s1) (i32.const 3))) (i32.xor (local.get $s2) (local.get $s3))))
        (i32.store8 (i32.add (local.get $i) (i32.const 1))
          (i32.xor (i32.xor (local.get $s0) (call $gf_mul (local.get $s1) (i32.const 2))) (i32.xor (call $gf_mul (local.get $s2) (i32.const 3)) (local.get $s3))))
        (i32.store8 (i32.add (local.get $i) (i32.const 2))
          (i32.xor (i32.xor (local.get $s0) (local.get $s1)) (i32.xor (call $gf_mul (local.get $s2) (i32.const 2)) (call $gf_mul (local.get $s3) (i32.const 3)))))
        (i32.store8 (i32.add (local.get $i) (i32.const 3))
          (i32.xor (i32.xor (call $gf_mul (local.get $s0) (i32.const 3)) (local.get $s1)) (i32.xor (local.get $s2) (call $gf_mul (local.get $s3) (i32.const 2)))))

        (local.set $c (i32.add (local.get $c) (i32.const 1)))
        (br_if $mix_loop (i32.lt_u (local.get $c) (i32.const 4)))
      )

      ;; AddRoundKey
      (local.set $off (i32.mul (local.get $round) (i32.const 4)))
      (local.set $c (i32.const 0))
      (loop $ark_loop
        (local.set $val (i32.load (i32.add (i32.const 0x0300) (i32.mul (i32.add (local.get $off) (local.get $c)) (i32.const 4)))))
        (i32.store8 (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4)))
          (i32.xor (i32.load8_u (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4)))) (i32.and (i32.shr_u (local.get $val) (i32.const 24)) (i32.const 255))))
        (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))
          (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))) (i32.and (i32.shr_u (local.get $val) (i32.const 16)) (i32.const 255))))
        (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))
          (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))) (i32.and (i32.shr_u (local.get $val) (i32.const 8)) (i32.const 255))))
        (i32.store8 (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))
          (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))) (i32.and (local.get $val) (i32.const 255))))
        (local.set $c (i32.add (local.get $c) (i32.const 1)))
        (br_if $ark_loop (i32.lt_u (local.get $c) (i32.const 4)))
      )

      (local.set $round (i32.add (local.get $round) (i32.const 1)))
      (br_if $r_loop (i32.lt_u (local.get $round) (i32.const 14)))
    )

    ;; Final Round 14: SubBytes
    (local.set $i (i32.const 0))
    (loop $f_sub
      (i32.store8
        (i32.add (i32.const 0x0070) (local.get $i))
        (i32.load8_u (i32.add (i32.const 0x0100) (i32.load8_u (i32.add (i32.const 0x0070) (local.get $i)))))
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $f_sub (i32.lt_u (local.get $i) (i32.const 16)))
    )

    ;; ShiftRows
    (local.set $a1 (i32.load8_u (i32.const 0x0071)))
    (i32.store8 (i32.const 0x0071) (i32.load8_u (i32.const 0x0075)))
    (i32.store8 (i32.const 0x0075) (i32.load8_u (i32.const 0x0079)))
    (i32.store8 (i32.const 0x0079) (i32.load8_u (i32.const 0x007d)))
    (i32.store8 (i32.const 0x007d) (local.get $a1))

    (local.set $a2 (i32.load8_u (i32.const 0x0072)))
    (local.set $a6 (i32.load8_u (i32.const 0x0076)))
    (i32.store8 (i32.const 0x0072) (i32.load8_u (i32.const 0x007a)))
    (i32.store8 (i32.const 0x0076) (i32.load8_u (i32.const 0x007e)))
    (i32.store8 (i32.const 0x007a) (local.get $a2))
    (i32.store8 (i32.const 0x007e) (local.get $a6))

    (local.set $a3 (i32.load8_u (i32.const 0x007f)))
    (i32.store8 (i32.const 0x007f) (i32.load8_u (i32.const 0x007b)))
    (i32.store8 (i32.const 0x007b) (i32.load8_u (i32.const 0x0077)))
    (i32.store8 (i32.const 0x0077) (i32.load8_u (i32.const 0x0073)))
    (i32.store8 (i32.const 0x0073) (local.get $a3))

    ;; AddRoundKey with round 14 (offset = 56)
    (local.set $off (i32.const 56))
    (local.set $c (i32.const 0))
    (loop $f_ark
      (local.set $val (i32.load (i32.add (i32.const 0x0300) (i32.mul (i32.add (local.get $off) (local.get $c)) (i32.const 4)))))
      (i32.store8 (i32.add (i32.const 0x0080) (i32.mul (local.get $c) (i32.const 4)))
        (i32.xor (i32.load8_u (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4)))) (i32.and (i32.shr_u (local.get $val) (i32.const 24)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0080) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 1))) (i32.and (i32.shr_u (local.get $val) (i32.const 16)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0080) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 2))) (i32.and (i32.shr_u (local.get $val) (i32.const 8)) (i32.const 255))))
      (i32.store8 (i32.add (i32.add (i32.const 0x0080) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))
        (i32.xor (i32.load8_u (i32.add (i32.add (i32.const 0x0070) (i32.mul (local.get $c) (i32.const 4))) (i32.const 3))) (i32.and (local.get $val) (i32.const 255))))
      (local.set $c (i32.add (local.get $c) (i32.const 1)))
      (br_if $f_ark (i32.lt_u (local.get $c) (i32.const 4)))
    )
  )

  ;; Increments big-endian counter at 0x0060
  (func $inc_counter
    (local $i i32)
    (local $v i32)
    (local.set $i (i32.const 15))
    (loop $inc_loop
      (local.set $v (i32.and (i32.add (i32.load8_u (i32.add (i32.const 0x0060) (local.get $i))) (i32.const 1)) (i32.const 255)))
      (i32.store8 (i32.add (i32.const 0x0060) (local.get $i)) (local.get $v))
      (if (i32.eq (local.get $v) (i32.const 0))
        (then
          (if (i32.gt_s (local.get $i) (i32.const 0))
            (then
              (local.set $i (i32.sub (local.get $i) (i32.const 1)))
              (br $inc_loop)
            )
          )
        )
      )
    )
  )

  ;; Export: Initialize cipher key schedule
  (func (export "initKey")
    (call $derive_sbox)
    (call $expand_key)
  )

  ;; Export: Process CTR mode on payload buffer at 0x1000
  (func (export "processCtr") (param $dataLen i32)
    (local $cursor i32)
    (local $blockLen i32)
    (local $i i32)
    (local.set $cursor (i32.const 0))
    (block $done
      (loop $main_loop
        (br_if $done (i32.ge_u (local.get $cursor) (local.get $dataLen)))
        (call $cipher_block)
        (local.set $blockLen (i32.sub (local.get $dataLen) (local.get $cursor)))
        (if (i32.gt_u (local.get $blockLen) (i32.const 16))
          (then (local.set $blockLen (i32.const 16)))
        )
        (local.set $i (i32.const 0))
        (loop $xor_loop
          (i32.store8
            (i32.add (i32.const 0x1000) (i32.add (local.get $cursor) (local.get $i)))
            (i32.xor
              (i32.load8_u (i32.add (i32.const 0x1000) (i32.add (local.get $cursor) (local.get $i))))
              (i32.load8_u (i32.add (i32.const 0x0080) (local.get $i)))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $xor_loop (i32.lt_u (local.get $i) (local.get $blockLen)))
        )
        (call $inc_counter)
        (local.set $cursor (i32.add (local.get $cursor) (local.get $blockLen)))
        (br $main_loop)
      )
    )
  )
)
