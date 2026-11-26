"""Exercise Google's PEPK tool with disposable test credentials, never production secrets."""
import os, subprocess, pathlib, tempfile, hashlib, zipfile, json, sys
root = pathlib.Path(__file__).resolve().parents[1]
jar = pathlib.Path(sys.argv[1]).resolve()
recipient_file = root / 'docs/native/google-play-encryption-public-key.txt'
helper = root / 'scripts/ExportPlaySigningKey.java'
with tempfile.TemporaryDirectory() as td:
    folder = pathlib.Path(td)
    key = folder / 'test.jks'
    password = 'TestOnly-Not-A-Production-Key-73'
    env = {**os.environ, 'CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS': 'test',
           'CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD': password,
           'CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD': password}
    subprocess.run(['keytool', '-genkeypair', '-alias', 'test', '-keyalg', 'RSA', '-keysize', '2048',
                    '-validity', '1', '-dname', 'CN=Temporary Test Only', '-keystore', str(key),
                    '-storepass', password, '-keypass', password], capture_output=True, check=True)
    cert = subprocess.run(['keytool', '-exportcert', '-alias', 'test', '-keystore', str(key),
                           '-storepass', password], capture_output=True, check=True).stdout
    pin = hashlib.sha256(cert).hexdigest()
    recipient = hashlib.sha256(recipient_file.read_bytes()).hexdigest()
    cases = [('valid', pin, recipient, {}, True),
             ('wrong-signer', '0'*64, recipient, {}, False),
             ('wrong-recipient', pin, '0'*64, {}, False),
             ('wrong-password', pin, recipient, {'CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD': 'Definitely-Wrong-Secret'}, False),
             ('missing-alias', pin, recipient, {'CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS': ''}, False)]
    for name, certificate, recipient_hash, overrides, success in cases:
        output = folder / (name + '.zip')
        result = subprocess.run(['java', '--class-path', str(jar), str(helper), str(key),
                                 str(recipient_file), str(output), certificate, recipient_hash],
                                env={**env, **overrides}, capture_output=True, text=True, timeout=40)
        assert (result.returncode == 0) == success, name
        assert password not in result.stdout + result.stderr, name
        assert 'Definitely-Wrong-Secret' not in result.stdout + result.stderr, name
        assert output.exists() == success, name
        if success:
            with zipfile.ZipFile(output) as bundle:
                assert set(bundle.namelist()) == {'encryptedPrivateKey', 'certificate.pem'}
                assert len(bundle.read('encryptedPrivateKey')) > 0
            assert key.read_bytes() not in output.read_bytes()
    print(json.dumps({'passed': [case[0] for case in cases], 'count': len(cases),
                      'productionCredentialsUsed': False}))
