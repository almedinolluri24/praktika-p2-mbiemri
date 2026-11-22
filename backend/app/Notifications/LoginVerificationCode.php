<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LoginVerificationCode extends Notification
{
    use Queueable;

    public function __construct(public readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Kodi yt i verifikimit për kyçje')
            ->greeting('Verifiko kyçjen në Foodora')
            ->line("Kodi yt i verifikimit është: {$this->code}")
            ->line('Kodi skadon pas 5 minutash dhe mund të përdoret vetëm një herë.')
            ->line('Nëse nuk e kërkove ti këtë kod, mund ta injorosh këtë email.');
    }
}
