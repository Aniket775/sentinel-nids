#!/bin/bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -R 80:localhost:8000 nokey@localhost.run 2>&1 | while read -r line; do
  echo "$line"
  if echo "$line" | grep -q "tunneled with tls termination"; then
    url=$(echo "$line" | grep -o 'https://[^ ]*')
    echo "PUBLIC_URL=$url" > public_url.txt
    echo "CAPTURED_PUBLIC_URL: $url"
  fi
done
