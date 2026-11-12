# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** form on this repository's Security tab, rather than in a public issue. You will get an acknowledgement within a few days.

## What counts

DI Doctor runs offline, makes no network calls (the simulator only listens on localhost), and stores nothing. Issues of interest include: the simulator server binding beyond localhost by default, anything that could leak the contents of a payload, or dependency vulnerabilities in the published packages.

## Please never include

Real NTN, CNIC or STRN values, FBR security tokens, or real invoice data in any report. Use the fake identifiers from `fixtures/` (`0000001`, `1111111111111`).
