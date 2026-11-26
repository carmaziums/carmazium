import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.jar.*;

/** Verify every payload entry, not merely the presence of a certificate file.
 * Android signing certificates are deliberately self-signed; trust is the
 * retained owner's SHA-256 pin, not a public certificate authority.
 * Bundle structure/manifest validation is separately performed by bundletool.
 */
public class VerifyAndroidAppBundle {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Usage: bundle.aab expected-certificate-sha256");
        String expected = args[1].replaceFirst("(?i)^\\s*SHA-?256\\s*:?", "")
            .replaceAll("[\\s:]", "").toLowerCase(Locale.ROOT);
        if (!expected.matches("[a-f0-9]{64}")) throw new SecurityException("Invalid certificate pin");
        int signed = 0;
        Set<String> names = new HashSet<>();
        try (JarFile jar = new JarFile(args[0], true)) {
            Enumeration<JarEntry> entries = jar.entries();
            byte[] buffer = new byte[65536];
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                String name = entry.getName();
                if (!names.add(name)) throw new SecurityException("Duplicate archive entry");
                if (entry.isDirectory()) continue;
                // Reading to EOF is necessary to trigger JarVerifier.
                try (InputStream input = jar.getInputStream(entry)) {
                    while (input.read(buffer) != -1) {}
                }
                if (name.matches("(?i)META-INF/(MANIFEST\\.MF|[^/]+\\.(SF|RSA|DSA|EC))")) continue;
                CodeSigner[] signers = entry.getCodeSigners();
                if (signers == null || signers.length != 1)
                    throw new SecurityException("Unsigned or multiply signed payload: " + name);
                var certificate = signers[0].getSignerCertPath().getCertificates().get(0);
                String actual = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(certificate.getEncoded()));
                if (!MessageDigest.isEqual(actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                        expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
                    throw new SecurityException("Payload certificate does not match retained signing identity");
                signed++;
            }
        }
        if (signed == 0 || !names.contains("BundleConfig.pb") || !names.contains("base/manifest/AndroidManifest.xml"))
            throw new SecurityException("Not a signed Android App Bundle");
        System.out.println("{\"signedPayloadEntries\":" + signed + ",\"certificateSha256\":\"" + expected + "\"}");
    }
}
