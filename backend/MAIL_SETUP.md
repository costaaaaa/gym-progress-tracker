# Email in casa sulla VPS (solo invio): Postfix + DKIM

Serve solo a mandare le email transazionali (recupero password) da `no-reply@liftindex.app`.
Nessuna casella in ricezione, nessun servizio esterno. PHP usa `mail()` con `MAIL_DRIVER=mail`.

Il difficile non è spedire ma **arrivare nella posta in arrivo**: Gmail e Outlook guardano
SPF, DKIM, DMARC, il reverse DNS dell'IP e la reputazione dell'IP. Un IP nuovo parte senza
reputazione: i primi invii possono finire nello spam (vedi "Se finisce nello spam").

## 0. Prima dell'acquisto: chiedi al supporto Aruba

1. **La porta 25 in uscita è aperta** sulla VPS? (Molti provider la chiudono di default.)
2. Posso impostare il **reverse DNS (PTR)** dell'IP su `mail.liftindex.app`?
3. L'IP è pulito? Dopo l'attivazione controlla su https://mxtoolbox.com/blacklists.aspx.

Senza i punti 1 e 2 la posta in casa non è affidabile: si passa a `MAIL_DRIVER=brevo`
(già supportato dal codice, cambia solo una variabile).

## 1. DNS (Cloudflare)

Sostituisci `IP_VPS` con l'IPv4 della VPS. I record di posta devono essere **"Solo DNS"**
(nuvola grigia), non proxati.

| Tipo | Nome | Valore |
|---|---|---|
| A | `mail` | `IP_VPS` |
| TXT | `@` | `v=spf1 ip4:IP_VPS -all` |
| TXT | `mail._domainkey` | il valore generato al punto 3 (`v=DKIM1; k=rsa; p=...`) |
| TXT | `_dmarc` | `v=DMARC1; p=none; adkim=s; aspf=s` (dopo 2 settimane di prove riuscite passa a `p=quarantine`) |

## 2. Postfix (sulla VPS, Ubuntu 24.04)

```bash
sudo apt install postfix opendkim opendkim-tools mailutils
# Durante l'installazione scegli "Internet Site" e come nome di sistema: mail.liftindex.app
```

In `/etc/postfix/main.cf` (imposta o aggiungi):

```
myhostname = mail.liftindex.app
myorigin = liftindex.app
mydestination = localhost
inet_interfaces = loopback-only
smtp_tls_security_level = may
# DKIM: la posta di mail()/sendmail passa dai "non_smtpd_milters", non solo dagli smtpd
milter_default_action = accept
milter_protocol = 6
smtpd_milters = inet:localhost:8891
non_smtpd_milters = $smtpd_milters
```

`inet_interfaces = loopback-only` fa sì che Postfix non accetti connessioni da fuori: solo
la VPS stessa può spedire.

## 3. DKIM (firma delle email)

```bash
sudo mkdir -p /etc/opendkim/keys/liftindex.app
sudo opendkim-genkey -b 2048 -d liftindex.app -D /etc/opendkim/keys/liftindex.app -s mail
sudo chown -R opendkim:opendkim /etc/opendkim/keys
sudo cat /etc/opendkim/keys/liftindex.app/mail.txt   # contiene il valore per il record DNS mail._domainkey
```

`/etc/opendkim.conf` (aggiungi o sostituisci):

```
Syslog          yes
Domain          liftindex.app
Selector        mail
KeyFile         /etc/opendkim/keys/liftindex.app/mail.private
Socket          inet:8891@localhost
Canonicalization relaxed/simple
```

Poi: `sudo systemctl restart opendkim postfix`.

## 4. PHP

Variabili d'ambiente di PHP (come `GYM_API_SECRET`, non nei repo):

```
MAIL_DRIVER=mail
MAIL_FROM_EMAIL=no-reply@liftindex.app
MAIL_FROM_NAME=Liftindex
APP_PUBLIC_URL=https://liftindex.app
```

`sendmail_path` di PHP-FPM deve puntare al sendmail di Postfix: il default di Ubuntu
(`/usr/sbin/sendmail -t -i`) va già bene.

## 5. Prova

```bash
echo "prova" | mail -s "Prova Liftindex" -a "From: no-reply@liftindex.app" TUA_EMAIL@gmail.com
sudo tail -f /var/log/mail.log      # deve comparire "status=sent"
```

In Gmail apri il messaggio → menu ⋮ → **Mostra originale**: devono comparire
`SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Se anche uno solo non passa, correggi il DNS prima
di aprire a utenti veri. Controllo esterno gratuito: mandare un messaggio all'indirizzo che
indica https://www.mail-tester.com (punteggio 9-10/10 è l'obiettivo).

Poi prova il flusso vero dell'app: «Password dimenticata» con un account di test.

## Se finisce nello spam

- Segna «Non è spam» sui primi invii: aiuta la reputazione nelle caselle di prova.
- Tieni il testo semplice, con un solo link e senza immagini (già così).
- Controlla che il PTR dell'IP coincida con `mail.liftindex.app` e che l'IP non sia in blocklist.
- Se dopo qualche giorno il problema resta, usa `MAIL_DRIVER=brevo` senza toccare il codice.
