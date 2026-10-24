import math
def sig(z): return 1/(1+math.exp(-z))
def loss(z): return -math.log(sig(z))
cases = [
 ("base", -1.2, -1.9, -1.5, -1.6, 0.1),
 ("lower_rejected", -1.2, -2.5, -1.5, -1.6, 0.1),
 ("both_up_0.6", -0.6, -1.3, -1.5, -1.6, 0.1),
 ("beta_0.5", -1.2, -1.9, -1.5, -1.6, 0.5),
 ("ref_ignored", -1.2, -1.9, -9.0, -9.0, 0.1),
]
for name, lw, ll, rw, rl, beta in cases:
    a = lw - rw; b = ll - rl; z = beta*(a-b)
    print("%-16s ratio_w %+.2f ratio_l %+.2f gap %+.2f z %+.4f sig %.4f loss %.4f" % (name,a,b,a-b,z,sig(z),loss(z)))
print("ln2=%.4f" % math.log(2))
print("sig(0.06)=%.6f sig(0.12)=%.6f sig(0.3)=%.6f" % (sig(0.06),sig(0.12),sig(0.3)))
