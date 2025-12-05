# Run Node.js Automatically on Reboot (systemd method)

## 1. Create a service file

Replace the path with your actual server location:

sudo nano /etc/systemd/system/pilotshelq.service

Paste this:

[Unit]
Description=Pilot Shelf Node.js App
After=network.target

[Service]
ExecStart=/usr/bin/node /home/pi/PILOT_SHELQ/backend/src/server.js
WorkingDirectory=/home/pi/PILOT_SHELQ/backend
Restart=always
RestartSec=10
User=pi
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

Save and exit.

## 2. Reload systemd
sudo systemctl daemon-reload

## 3. Enable the service on boot
sudo systemctl enable pilotshelq

## 4. Start it now
sudo systemctl start pilotshelq

## 5. Check status
sudo systemctl status pilotshelq

You should see "running".

## 6. If you change server.js later
sudo systemctl restart pilotshelq




## for crash logs
sudo journalctl -u pilotshelq -n 50 --no-pager
