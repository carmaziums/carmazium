import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.io.PrintStream;
import java.io.OutputStream;

/** Exports an existing verified signer to Google's pinned public encryption key.
 * Passwords enter through environment variables and never appear in process arguments.
 */
public class ExportPlaySigningKey {
  private static String required(String name) {
    String value = System.getenv(name);
    if (value == null || value.isEmpty()) throw new IllegalArgumentException("Missing signing environment");
    return value;
  }
  private static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static void main(String[] args) throws Exception {
    try {
      if (args.length != 5 || !args[3].matches("[a-f0-9]{64}") || !args[4].matches("[a-f0-9]{64}"))
        throw new IllegalArgumentException("Invalid export parameters");
      Path store = Path.of(args[0]), recipient = Path.of(args[1]), output = Path.of(args[2]);
      if (!Files.isRegularFile(store) || !Files.isRegularFile(recipient) || Files.exists(output))
        throw new IllegalArgumentException("Invalid export files");
      if (!sha(Files.readAllBytes(recipient)).equals(args[4]))
        throw new IllegalArgumentException("Recipient key mismatch");
      String alias = required("CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS");
      String storePass = required("CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD");
      String keyPass = required("CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD");
      KeyStore ks = KeyStore.getInstance(store.toFile(), storePass.toCharArray());
      if (!ks.isKeyEntry(alias) || !sha(ks.getCertificate(alias).getEncoded()).equals(args[3]))
        throw new IllegalArgumentException("Original signer mismatch");
      if (!(ks.getKey(alias, keyPass.toCharArray()) instanceof PrivateKey))
        throw new IllegalArgumentException("Private key unavailable");
      String[] pepkArgs = {
        "--keystore=" + store, "--alias=" + alias, "--output=" + output,
        "--rsa-aes-encryption", "--encryption-key-path=" + recipient, "--include-cert",
        "--keystore-pass=" + storePass, "--key-pass=" + keyPass
      };
      PrintStream originalOut = System.out, originalErr = System.err;
      try {
        System.setOut(new PrintStream(OutputStream.nullOutputStream()));
        System.setErr(new PrintStream(OutputStream.nullOutputStream()));
      Class.forName("com.google.wireless.android.vending.developer.signing.tools.extern.export.ExportEncryptedPrivateKeyTool")
        .getMethod("main", String[].class).invoke(null, (Object)pepkArgs);
      } finally {
        System.setOut(originalOut); System.setErr(originalErr);
        Arrays.fill(pepkArgs, "");
      }
      Arrays.fill(pepkArgs, "");
      if (!Files.isRegularFile(output) || Files.size(output) == 0)
        throw new IllegalStateException("No encrypted export");
      System.out.println("Original certificate verified; Google-encrypted export created.");
    } catch (Exception error) {
      // PEPK or keystore exceptions may include arguments. Never print those.
      System.err.println("Signing-key export blocked. No credential or key data is logged.");
      System.exit(1);
    }
  }
}
