<!DOCTYPE html>
<html>
<head>
    <title>Recuperação de Senha</title>
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
        <h2 style="color: #25aae1;">Olá!</h2>
        <p>Você está recebendo este e-mail porque recebemos uma solicitação de redefinição de senha para sua conta.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ $resetUrl }}" style="background-color: #25aae1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Senha</a>
        </div>
        <p>Este link de redefinição de senha expirará em 60 minutos.</p>
        <p>Se você não solicitou uma redefinição de senha, nenhuma ação adicional é necessária.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999;">Se você estiver tendo problemas para clicar no botão "Redefinir Senha", copie e cole a URL abaixo no seu navegador:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">{{ $resetUrl }}</p>
    </div>
</body>
</html>
